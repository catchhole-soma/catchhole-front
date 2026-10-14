export function ChatAnswerNotes({ notes }: { notes: string[] }) {
  const uniqueNotes = [...new Set(notes)];
  if (uniqueNotes.length === 0) return null;

  return (
    <aside className="chat-answer-notes" aria-label="답변에서 확인할 점">
      <h3>답변에서 확인할 점</h3>
      <ul>
        {uniqueNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </aside>
  );
}
