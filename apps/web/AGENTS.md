<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git politikası

2026-09-25'e kadar bu kurallar üç `alwaysApply` Cursor kuralında yaşıyordu.
Cursor artık kullanılmıyor (Dinçer Claude Code, Tuğrul Codex); eski dosyalar
`docs/archive/cursor-rules-2026-09/` altında arşivdir. Geçerli kurallar:

- `main`'e doğrudan commit ya da push yapılmaz.
- Entegrasyon dalı `integration/talepo-dev`'dir; yalnız fast-forward ile ilerler, oraya push açık talimat ister.
- Dal adları: Dinçer `feature/dincer-*`, Tuğrul `feature/tugrul-*`; başka geliştiricinin dalında veya worktree'sinde çalışılmaz. `recovery/*` dalları arşivdir, geliştirme tabanı değildir.
- Her görevin başında branch, HEAD, upstream ve `git status` doğrulanır; uzak durum `git fetch origin` ile okunur.
- `git add .` kullanılmaz; yalnız görev kapsamındaki dosyalar stage edilir ve kapsam dışı değişiklik aynı commit'e eklenmez.
- Açık onay olmadan: force push, `git reset --hard`, `git clean -fd`, stash/discard, dal silme, history rewrite yok.
- `.env`, sırlar, `node_modules`, log, ekran görüntüsü ve geçici çıktılar commit edilmez; sır değerleri yazdırılmaz.
- Conventional commit (`feat|fix|refactor|test|chore|docs`); mesaja geliştirici adı yazılmaz.
