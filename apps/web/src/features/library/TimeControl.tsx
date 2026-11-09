const icons: Record<string, string> = {
  rapid: "timer",
  blitz: "zap",
  bullet: "rocket",
};

export function TimeControl({ value }: { value: string | null }) {
  const icon = value ? icons[value] : undefined;
  return (
    <span className="time-control">
      {icon && (
        <img src={`/icons/lucide/${icon}.svg`} width="20" height="20" alt="" />
      )}
      <span>
        {value
          ? value.charAt(0).toUpperCase() + value.slice(1)
          : "Unknown time control"}
      </span>
    </span>
  );
}
