interface Props {
  text: string;
  className?: string;
}

export default function MentionText({ text, className = '' }: Props) {
  const parts = text.split(/(@\w+)/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="text-primary-600 font-medium">{part}</span>
        ) : (
          part
        )
      )}
    </span>
  );
}
