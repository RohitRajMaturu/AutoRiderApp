export function ConceptBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-16 -top-16 h-72 w-72 rounded-full bg-[#D3DBDD]/60" />
      <div className="absolute bottom-[-92px] left-[11%] h-56 w-56 rounded-full bg-[#DDE4E6]/70" />
      <div className="absolute right-[-100px] top-[-80px] h-72 w-72 rounded-full border border-[#CFD8DA]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(67,184,179,0.12),transparent_34%)]" />
    </div>
  );
}
