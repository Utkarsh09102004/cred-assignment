'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useConversation } from './ConversationContext';

const GROUP_STYLES = {
  AND: {
    label: 'AND',
    gradient: 'from-[#1a1a22]/80 to-[#0f0f17]/80',
    border: 'border-[#5645ee]/40',
    text: 'text-white/70',
  },
  OR: {
    label: 'OR',
    gradient: 'from-[#2a2434]/80 to-[#1a1a22]/80',
    border: 'border-[#6d5df5]/40',
    text: 'text-white/70',
  },
};

function AttributeCard({ attribute, operator, value }) {
  const displayValue = String(value);
  const truncatedValue = displayValue.length > 10 ? displayValue.substring(0, 10) + '...' : displayValue;
  const truncatedAttribute = attribute.length > 15 ? attribute.substring(0, 15) + '...' : attribute;

  return (
    <div className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 overflow-hidden" title={`${attribute} ${operator} ${displayValue}`}>
      <span className="text-[#fbbf24] text-[10px] px-1.5 py-0.5 rounded bg-[#fbbf24]/10 font-medium shrink-0">
        Attr
      </span>
      <span className="font-medium text-white/80 truncate">{truncatedAttribute}</span>
      <span className="text-white/50 shrink-0">{operator}</span>
      <span className="text-white truncate">{truncatedValue}</span>
    </div>
  );
}

function SegmentCard({ keyName }) {
  const truncatedKey = keyName.length > 20 ? keyName.substring(0, 20) + '...' : keyName;

  return (
    <div className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 overflow-hidden" title={`Is in segment "${keyName}"`}>
      <span className="text-[#10b981] text-[10px] px-1.5 py-0.5 rounded bg-[#10b981]/10 font-medium shrink-0">
        Seg
      </span>
      <span className="text-white/60 shrink-0">Is in</span>
      <span className="font-medium text-white/90 truncate">"{truncatedKey}"</span>
    </div>
  );
}

function TreeGroup({ node, depth = 0 }) {
  const isGroup = node?.type === 'AND' || node?.type === 'OR';
  if (!isGroup) {
    if (node?.type === 'segment') {
      return <SegmentCard keyName={node.key} />;
    }
    if (node?.type === 'attribute') {
      return (
        <AttributeCard
          attribute={node.attribute}
          operator={node.operator}
          value={node.value}
        />
      );
    }
    return null;
  }

  const style = GROUP_STYLES[node.type] || GROUP_STYLES.AND;
  return (
    <div
      className={`relative border ${style.border} rounded-lg bg-gradient-to-br ${style.gradient} p-2 space-y-2 backdrop-blur-sm`}
      style={{ marginLeft: Math.min(depth * 8, 24) }}
    >
      <div
        className={`text-[10px] font-semibold uppercase tracking-wider ${style.text} flex items-center gap-1.5`}
      >
        <span className="h-4 w-1 rounded-full bg-[#5645ee]/40" />
        {style.label}
      </div>
      <div className="space-y-1.5">
        {(node.children || []).map((child, idx) => (
          <div key={idx}>
            <TreeGroup node={child} depth={depth + 1} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RightSidebar({
  initialWidth = 360,
  minWidth = 260,
  maxWidth = 520,
}) {
  const { conversationId } = useConversation();
  const [width, setWidth] = useState(initialWidth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tree, setTree] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(0);
  const activeVersion = useMemo(
    () => (versions.length > 0 ? versions[selectedVersion] : null),
    [versions, selectedVersion]
  );
  const activeTree = useMemo(
    () => (activeVersion?.treeState ? activeVersion.treeState : tree),
    [activeVersion, tree]
  );
  const activeValidation = activeVersion?.validationOutput || null;
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(initialWidth);

  const fetchTree = useCallback(async () => {
    if (!conversationId) {
      setTree(null);
      setVersions([]);
      setSelectedVersion(0);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/conversations/${conversationId}/tree`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load tree');
      }
      const nextTree = data.tree || null;
      const nextVersions = data.versions || [];
      setTree(nextTree);
      setVersions(nextVersions);
      setSelectedVersion(
        nextVersions.length > 0 ? nextVersions.length - 1 : 0
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = evt => {
      if (!conversationId || !evt?.detail) return;
      if (evt.detail.conversationId === conversationId) {
        fetchTree();
      }
    };
    window.addEventListener('tree-updated', handler);
    return () => window.removeEventListener('tree-updated', handler);
  }, [conversationId, fetchTree, tree]);

  useEffect(() => {
    function handleMouseMove(e) {
      if (!isDragging.current) return;
      const delta = e.clientX - startX.current;
      // Sidebar sits on the right; dragging the handle right should reduce width,
      // dragging left should expand. Invert delta to reflect that.
      const nextWidth = Math.min(
        maxWidth,
        Math.max(minWidth, startWidth.current - delta)
      );
      setWidth(nextWidth);
    }

    function handleMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [maxWidth, minWidth]);

  const startDrag = e => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const downloadJson = useCallback(
    (data, filename) => {
      if (!data) {
        setError('Nothing to download yet.');
        return;
      }
      try {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Download failed', err);
        setError('Failed to download file.');
      }
    },
    []
  );

  return (
    <aside
      style={{ width }}
      className="relative h-screen bg-[#111017] text-white border-l border-white/5 shadow-2xl flex flex-col"
    >
      <div
        onMouseDown={startDrag}
        className="absolute -left-1 top-0 h-full w-2 cursor-col-resize group"
      >
        <div className="h-full w-[3px] mx-auto bg-white/10 group-hover:bg-[#5645ee] transition-colors rounded-full" />
      </div>

      <div className="p-4 border-b border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedVersion(v => Math.max(0, v - 1))}
            disabled={selectedVersion <= 0}
            className="h-8 w-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40"
            aria-label="Previous version"
          >
            ←
          </button>
          <div className="text-sm text-white/70">
            {versions.length > 0
              ? `Version ${versions[selectedVersion]?.version || 1} of ${versions.length}`
              : 'No versions'}
          </div>
          <button
            onClick={() =>
              setSelectedVersion(v => Math.min(versions.length - 1, v + 1))
            }
            disabled={selectedVersion >= versions.length - 1 || versions.length === 0}
            className="h-8 w-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40"
            aria-label="Next version"
          >
            →
          </button>
        </div>
        <button
          onClick={fetchTree}
          className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition"
        >
          Refresh
        </button>
      </div>

      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3 bg-white/5">
        <div className="text-xs text-white/60">Exports</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              downloadJson(
                activeTree,
                'final_tree.json'
              )
            }
            disabled={!activeTree}
            className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 transition"
          >
            Download Tree
          </button>
          <button
            onClick={() =>
              downloadJson(
                activeValidation,
                'validation_report.json'
              )
            }
            disabled={!activeValidation}
            className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 transition"
          >
            Download Validation
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        {loading && (
          <div className="text-white/50 text-xs">Loading tree...</div>
        )}
        {error && (
          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-300/30 p-2 rounded-lg">
            {error}
          </div>
        )}
        {!loading && !error && (
          <div className="w-full">
            {versions.length > 0 ? (
              <TreeGroup node={versions[selectedVersion]?.treeState} />
            ) : tree ? (
              <TreeGroup node={tree} />
            ) : (
              <div className="text-xs text-white/50">No validated tree yet.</div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
