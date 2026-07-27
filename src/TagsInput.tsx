import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Chip } from './ui';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  hjaelpetekst?: string;
  farve?: 'default' | 'accent' | 'advarsel' | 'fejl';
}

function TagsInput({ tags, onChange, label, hjaelpetekst, farve = 'default' }: Props) {
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

  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', color: 'var(--tekst-dæmpet)', marginBottom: '5px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {visLabel}
        {hjaelpetekst && <span style={{ color: 'var(--tekst-svag)', marginLeft: '8px', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· {hjaelpetekst}</span>}
      </label>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '8px',
        background: 'var(--input-bg)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        alignItems: 'center',
        minHeight: '42px'
      }}>
        {tags.map((tag) => (
          <Chip key={tag} farve={farve} onFjern={() => fjern(tag)}>{tag}</Chip>
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
          marginTop: '4px',
          background: 'var(--bg-forhoejet)',
          border: '1px solid var(--border-svag)',
          borderRadius: '8px',
          overflow: 'hidden',
          maxHeight: '150px',
          overflowY: 'auto'
        }}>
          {forslag.map((tag) => (
            <div
              key={tag}
              onClick={() => tilfoej(tag)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                borderBottom: '1px solid var(--border-svag)'
              }}
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