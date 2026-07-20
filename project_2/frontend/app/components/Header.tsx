export default function Header() {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white font-bold">
          UG
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">
            UniGate Academic Assistant
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Secure MCP · OAuth 2.1 · scoped tools
          </p>
        </div>
      </div>
      <a
        href="https://modelcontextprotocol.io"
        target="_blank"
        rel="noreferrer"
        className="hidden sm:inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        Model Context Protocol ↗
      </a>
    </header>
  );
}
