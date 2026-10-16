import { useId, useState } from 'react';

export function ChatAnswerNotes({ notes }: { notes: string[] }) {
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const uniqueNotes = [...new Set(notes)];
  if (uniqueNotes.length === 0) return null;

  return (
    <aside className="chat-answer-notes" aria-label="답변에서 확인할 점">
      {uniqueNotes.length === 1 ? (
        <p>{uniqueNotes[0]}</p>
      ) : (
        <>
          <button
            type="button"
            className="chat-answer-notes-toggle"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded((value) => !value)}
          >
            <span>답변에서 확인할 점 {uniqueNotes.length}가지</span>
            <span className="chat-answer-notes-action">
              {expanded ? '접기' : '펼치기'}
            </span>
          </button>
          <ul id={detailsId} hidden={!expanded}>
            {uniqueNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
