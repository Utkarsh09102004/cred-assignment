import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request) {
  try {
    const attributes = await prisma.attribute.findMany({
      orderBy: { id: 'asc' },
    });

    // Parse JSON fields back to objects/arrays
    const parsedAttributes = attributes.map(attr => ({
      ...attr,
      ops: JSON.parse(attr.ops),
      enumValues: attr.enumValues ? JSON.parse(attr.enumValues) : null,
      schema: attr.schema ? JSON.parse(attr.schema) : null,
    }));

    const count = await prisma.attribute.count();

    return NextResponse.json({
      success: true,
      attributes: parsedAttributes,
      count,
    });
  } catch (error) {
    console.error('Get attributes error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
