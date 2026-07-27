import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  hjaelpetekst?: string;
  farve?: string;
}

function TagsInput({ tags, onChange, label, hjaelpetekst, farve }: Props) {
  const visLabel = label ?? 'Tags';
  const [input, setInput] = useState('');
  const [fokuseret, setFokuseret] = useState(false);

  const alleItems = useLiveQuery(() => db.items.toArray());

  const alleTags = useMemo(() => {
    if (!alleItems) return [];
    const taeller = new Map<string, number>();
    alleItems.forEach((item) => {
      const alle = [
        ...(item.tags ?? []),
        ...(item.kraever ?? []),
        ...(item.komplementer ?? [])
      ];
      alle.forEach((tag) => {
        taeller.set(tag, (taeller.get(tag) ?? 0) + 1);
      });
    });
    return Array.from(taeller.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }, [alleItems]);

  const forslag = useMemo(() => {
    if (!input) return [];
    const q = input.toLowerCase();
    return alleTags
      .filter((tag) => tag.toLowerCase().includes(q) && !tags.includes(tag))
      .slice(0, 5);
  }, [input, alleTags, tags]);

  const tilfoej = (tag: string) => {
    const rent = tag.trim().toLowerCase();
    if (!rent || tags.includes(rent)) {
      setInput('');
      return;
    }
    onChange([...tags, rent]);
    setInput('');
  };

  const fjern = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      tilfoej(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const chipBg = farve ? farve + '20' : '#e0e0e0';
  const chipColor = farve ?? '#333';

  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
        {visLabel}
        {hjaelpetekst && <span style={{ color: '#999', marginLeft: '6px', fontSize: '11px' }}>· {hjaelpetekst}</span>}
      </label>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '8px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        alignItems: 'center',
        minHeight: '38px'
      }}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              background: chipBg,
              color: chipColor,
              borderRadius: '12px',
              fontSize: '12px'
            }}
          >
            {tag}
            <button
              onClick={() => fjern(tag)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontSize: '14px',
                lineHeight: 1,
                color: chipColor
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFokuseret(true)}
          onBlur={() => setTimeout(() => setFokuseret(false), 150)}
          placeholder={tags.length === 0 ? 'Skriv et tag og tryk Enter' : ''}
          style={{
            flex: 1,
            minWidth: '120px',
            padding: '4px',
            fontSize: '13px',
            border: 'none',
            outline: 'none',
            background: 'transparent'
          }}
        />
      </div>

      {fokuseret && forslag.length > 0 && (
        <div style={{
          border: '1px solid #ddd',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          background: 'white',
          maxHeight: '150px',
          overflowY: 'auto'
        }}>
          {forslag.map((tag) => (
            <div
              key={tag}
              onClick={() => tilfoej(tag)}
              style={{
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: '13px',
                borderBottom: '1px solid #f0f0f0'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TagsInput;