{/* Header */}
<header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
  <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="size-9 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-brand)" }}>
        <Sparkles className="size-5" />
      </div>
      <div>
        <h1 className="text-lg font-semibold tracking-tight">KeywordForge</h1>
        <p className="text-xs text-muted-foreground">AI Keyword & Content Strategy</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <ProjectSwitcher />
      <Link to="/articles">
        <Button variant="outline" size="sm"><FileText className="size-3.5 mr-1.5" />Artikel SEO</Button>
      </Link>
      <Link to="/transcripts">
        <Button variant="outline" size="sm"><Mic className="size-3.5 mr-1.5" />Transcripts</Button>
      </Link>
      {/* Tambahkan link menu Rework di sini */}
      <Link to="/rework">
        <Button variant="outline" size="sm"><RefreshCw className="size-3.5 mr-1.5" />Rework</Button>
      </Link>
      <Link to="/history">
        <Button variant="outline" size="sm"><History className="size-3.5 mr-1.5" />History</Button>
      </Link>
    </div>
  </div>
</header>
