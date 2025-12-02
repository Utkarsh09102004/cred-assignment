import { prisma } from './prisma.js';

const API_BASE_URL = process.env.API_BASE_URL;
const BEARER_TOKEN = process.env.BEARER_TOKEN;

/**
 * Fetch API with authorization headers
 */
async function fetchAPI(endpoint, params = {}) {
  const url = new URL(endpoint, API_BASE_URL);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch users metadata
 */
async function fetchUsersMeta() {
  return fetchAPI('/v1/users/meta');
}

/**
 * Fetch a single page of users
 */
async function fetchUsersPage(limit, offset) {
  return fetchAPI('/v1/users', { limit, offset });
}

/**
 * Fetch changed users since a timestamp
 */
async function fetchUsersChanges(since) {
  return fetchAPI('/v1/users/changes', {
    since: since.toISOString()
  });
}

/**
 * Fetch all attributes list
 */
async function fetchAttributesList() {
  return fetchAPI('/v1/attributes');
}

/**
 * Fetch attribute details by ID
 */
async function fetchAttributeById(attributeId) {
  return fetchAPI(`/v1/attributes/${attributeId}`);
}

/**
 * Get or create sync metadata singleton
 */
async function getOrCreateSyncMetadata() {
  let metadata = await prisma.syncMetadata.findUnique({
    where: { id: 'singleton' },
  });

  if (!metadata) {
    metadata = await prisma.syncMetadata.create({
      data: { id: 'singleton' },
    });
  }

  return metadata;
}

/**
 * Update sync metadata
 */
async function updateSyncMetadata(data) {
  return prisma.syncMetadata.update({
    where: { id: 'singleton' },
    data,
  });
}

/**
 * Upsert segments to database
 */
async function upsertSegments(segmentNames) {
  const operations = segmentNames.map(name =>
    prisma.segment.upsert({
      where: { name },
      update: { updatedAt: new Date() },
      create: { name },
    })
  );

  await prisma.$transaction(operations);
}

/**
 * Upsert attributes to database
 */
async function upsertAttributes(attributes) {
  const operations = attributes.map(attr =>
    prisma.attribute.upsert({
      where: { id: attr.id },
      update: {
        name: attr.name,
        type: attr.type,
        ops: JSON.stringify(attr.ops),
        description: attr.description,
        enumValues: attr.enum_values ? JSON.stringify(attr.enum_values) : null,
        min: attr.min ?? null,
        max: attr.max ?? null,
        itemType: attr.item_type ?? null,
        schema: attr.schema ? JSON.stringify(attr.schema) : null,
        updatedAt: new Date(),
      },
      create: {
        id: attr.id,
        name: attr.name,
        type: attr.type,
        ops: JSON.stringify(attr.ops),
        description: attr.description,
        enumValues: attr.enum_values ? JSON.stringify(attr.enum_values) : null,
        min: attr.min ?? null,
        max: attr.max ?? null,
        itemType: attr.item_type ?? null,
        schema: attr.schema ? JSON.stringify(attr.schema) : null,
      },
    })
  );

  await prisma.$transaction(operations);
}

/**
 * Sync all attributes - fetch list then details in parallel
 */
async function syncAttributes() {
  const startTime = Date.now();

  // 1. Fetch list of all attributes
  const attributesList = await fetchAttributesList();

  // 2. Fetch details for all attributes in parallel
  const attributeDetailsPromises = attributesList.map(attr =>
    fetchAttributeById(attr.id)
  );

  const attributesDetails = await Promise.all(attributeDetailsPromises);

  // 3. Upsert to database
  await upsertAttributes(attributesDetails);

  const duration = Date.now() - startTime;

  return {
    attributesCount: attributesDetails.length,
    duration,
  };
}

/**
 * Initial sync - fetch all users in parallel
 */
async function initialSync(metadata, onProgress) {
  const startTime = Date.now();

  // Fetch metadata
  const apiMeta = await fetchUsersMeta();
  const { total_users, max_page_size } = apiMeta;

  // Calculate total pages
  const totalPages = Math.ceil(total_users / max_page_size);

  // Update metadata with API info
  await updateSyncMetadata({
    totalUsers: total_users,
    maxPageSize: max_page_size,
  });

  // Create array of page fetch promises for parallel execution
  const pagePromises = Array.from({ length: totalPages }, (_, i) => {
    const offset = i * max_page_size;
    return fetchUsersPage(max_page_size, offset).then(data => {
      // Report progress after each page completes
      const progress = ((i + 1) / totalPages) * 100;
      onProgress?.({
        currentPage: i + 1,
        totalPages,
        progress,
      });
      return data;
    });
  });

  // Fetch all pages in parallel
  const pages = await Promise.all(pagePromises);

  // Collect all unique segments
  const allSegments = new Set();
  pages.forEach(page => {
    page.items.forEach(user => {
      user.segments.forEach(seg => allSegments.add(seg));
    });
  });

  const segmentArray = Array.from(allSegments);

  // Upsert segments to database
  await upsertSegments(segmentArray);

  // Sync attributes in parallel with segments
  const attributesResult = await syncAttributes();

  // Update metadata
  await updateSyncMetadata({
    lastSyncAt: new Date(),
    isInitialSync: false,
    totalSegments: segmentArray.length,
    totalAttributes: attributesResult.attributesCount,
  });

  const duration = Date.now() - startTime;

  return {
    syncType: 'initial',
    segmentsAdded: segmentArray.length,
    totalSegments: segmentArray.length,
    attributesAdded: attributesResult.attributesCount,
    totalAttributes: attributesResult.attributesCount,
    pagesProcessed: totalPages,
    duration,
  };
}

/**
 * Incremental sync - fetch only changed users
 */
async function incrementalSync(metadata) {
  const startTime = Date.now();

  if (!metadata.lastSyncAt) {
    throw new Error('No last sync timestamp found. Run initial sync first.');
  }

  // Fetch changed users
  const changesData = await fetchUsersChanges(metadata.lastSyncAt);
  const { items: changedUsers } = changesData;

  if (changedUsers.length === 0) {
    // No changes, just update cursor
    await updateSyncMetadata({
      lastSyncAt: new Date(),
    });

    return {
      syncType: 'incremental',
      segmentsAdded: 0,
      totalSegments: metadata.totalSegments,
      changedUsers: 0,
      duration: Date.now() - startTime,
    };
  }

  // Collect all unique segments from changed users
  const newSegments = new Set();
  changedUsers.forEach(user => {
    user.segments.forEach(seg => newSegments.add(seg));
  });

  const segmentArray = Array.from(newSegments);

  // Upsert segments
  await upsertSegments(segmentArray);

  // Sync attributes on every sync
  const attributesResult = await syncAttributes();

  // Get updated total count
  const totalSegments = await prisma.segment.count();

  // Update metadata
  await updateSyncMetadata({
    lastSyncAt: new Date(),
    totalSegments,
    totalAttributes: attributesResult.attributesCount,
  });

  const duration = Date.now() - startTime;

  return {
    syncType: 'incremental',
    segmentsAdded: segmentArray.length,
    totalSegments,
    attributesAdded: attributesResult.attributesCount,
    totalAttributes: attributesResult.attributesCount,
    changedUsers: changedUsers.length,
    duration,
  };
}

/**
 * Main sync function - determines strategy and executes
 */
export async function syncSegments(onProgress) {
  try {
    // Get or create sync metadata
    const metadata = await getOrCreateSyncMetadata();

    // Determine sync strategy
    if (metadata.isInitialSync) {
      return await initialSync(metadata, onProgress);
    } else {
      return await incrementalSync(metadata);
    }
  } catch (error) {
    console.error('Sync failed:', error);
    throw error;
  }
}

/**
 * Get all segments from database
 */
export async function getAllSegments() {
  return prisma.segment.findMany({
    orderBy: { name: 'asc' },
  });
}

/**
 * Get sync status
 */
export async function getSyncStatus() {
  const metadata = await getOrCreateSyncMetadata();
  const segmentCount = await prisma.segment.count();

  return {
    lastSyncAt: metadata.lastSyncAt,
    isInitialSync: metadata.isInitialSync,
    totalSegments: segmentCount,
    totalUsers: metadata.totalUsers,
  };
}
