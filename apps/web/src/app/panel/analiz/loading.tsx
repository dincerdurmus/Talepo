export default function AnalizLoading() {
  return (
    <div className="talepo-analysis mx-auto w-full max-w-[64rem] pb-6 pt-1 sm:pb-8 sm:pt-2">
      <div className="talepo-beacon-shell overflow-hidden rounded-[1.75rem] sm:rounded-[2rem]">
        <div className="talepo-my-requests-banner px-5 py-4 sm:px-8 sm:py-5 lg:px-9 lg:py-6">
          <div className="relative flex min-h-[8.75rem] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="min-w-0 max-w-xl">
              <div className="h-2.5 w-44 rounded-full bg-white/15" />
              <div className="mt-3 h-8 w-28 rounded-lg bg-white/20" />
              <div className="mt-3 h-4 w-72 max-w-full rounded bg-white/12" />
            </div>
            <div className="w-full lg:w-[19.5rem]">
              <div className="h-[4.5rem] rounded-2xl bg-white/10" />
              <div className="mt-3 h-11 rounded-xl bg-white/18" />
            </div>
          </div>
        </div>
        <div className="space-y-3 px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex gap-2">
            <div className="h-11 w-24 rounded-full bg-white" />
            <div className="h-11 w-24 rounded-full bg-white" />
            <div className="h-11 w-24 rounded-full bg-white" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="h-[7.25rem] rounded-[1.15rem] bg-white" />
            <div className="h-[7.25rem] rounded-[1.15rem] bg-white" />
            <div className="h-[7.25rem] rounded-[1.15rem] bg-white" />
            <div className="h-[7.25rem] rounded-[1.15rem] bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
