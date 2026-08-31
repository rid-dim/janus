import MarkdownIt from 'markdown-it';

/**
 * A markdown-it instance tuned for Janus. It adds three Janus-specific behaviours:
 *
 *  1. ```plotly fenced blocks  ->  <div class="janus-plot" data-spec="<uri-encoded json>">
 *     (rendered client-side by lazy-loading plotly.js)
 *  2. GitHub task lists ( - [ ] / - [x] ) -> real <input type=checkbox> carrying a
 *     per-document data-task-index so the UI can write a toggle back to the exact line.
 *  3. Links:
 *       - href starting with "doc:"  -> project-relative document link (opened on disk)
 *       - absolute / file: links     -> disk link (opened on disk)
 *     Both become <a class="janus-doclink" data-target="..."> handled client-side.
 */

function taskListPlugin(md) {
	md.core.ruler.after('inline', 'janus-tasklists', (state) => {
		const tokens = state.tokens;
		let taskIndex = 0;
		for (let i = 2; i < tokens.length; i++) {
			const inline = tokens[i];
			if (
				inline.type !== 'inline' ||
				tokens[i - 1].type !== 'paragraph_open' ||
				tokens[i - 2].type !== 'list_item_open'
			) {
				continue;
			}
			if (!/^\[[ xX]\][  ]/.test(inline.content)) continue;

			const checked = /^\[[xX]\]/.test(inline.content);
			const idx = taskIndex++;

			// mark the surrounding <li> for styling
			tokens[i - 2].attrJoin('class', 'janus-task');

			// build the checkbox token
			const box = new state.Token('html_inline', '', 0);
			box.content =
				`<input class="janus-cb" type="checkbox" data-task-index="${idx}"` +
				(checked ? ' checked' : '') +
				'>';

			// strip the "[ ] " / "[x] " prefix from the first text child, then prepend the box
			const children = inline.children;
			if (children.length && children[0].type === 'text') {
				children[0].content = children[0].content.replace(/^\[[ xX]\][  ]/, '');
			}
			children.unshift(box);
			inline.content = inline.content.replace(/^\[[ xX]\][  ]/, '');
		}
	});
}

function fencePlugin(md) {
	const defaultFence =
		md.renderer.rules.fence ||
		((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

	md.renderer.rules.fence = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		const info = (token.info || '').trim().toLowerCase();
		if (info === 'plotly' || info === 'chart') {
			const spec = encodeURIComponent(token.content);
			return `<div class="janus-plot" data-spec="${spec}"><div class="janus-plot-fallback">📈 Chart …</div></div>\n`;
		}
		return defaultFence(tokens, idx, options, env, self);
	};
}

function wikilinkPlugin(md) {
	// [[seite]] / [[unterordner/seite]] / [[seite|Linktext]] – Querverweise auf
	// wissen/-Seiten. Die Auflösung (existiert die Seite?) passiert beim Rendern
	// über env.wiki = { slugs: Set<string>, base: '/projekt/<id>/wiki/' };
	// ohne env.wiki wird nur der Text gezeigt (z. B. in Vorschau-Kontexten).
	md.inline.ruler.before('link', 'janus_wikilink', (state, silent) => {
		const src = state.src;
		const pos = state.pos;
		if (src.charCodeAt(pos) !== 0x5b /* [ */ || src.charCodeAt(pos + 1) !== 0x5b) return false;
		const end = src.indexOf(']]', pos + 2);
		if (end < 0) return false;
		const inner = src.slice(pos + 2, end);
		if (!inner.trim() || /[[\]\n]/.test(inner)) return false;
		if (!silent) {
			const sep = inner.indexOf('|');
			const target = (sep >= 0 ? inner.slice(0, sep) : inner).trim().replace(/\.md$/i, '');
			const alias = sep >= 0 ? inner.slice(sep + 1).trim() : '';
			const token = state.push('janus_wikilink', '', 0);
			token.meta = { target, alias };
			token.content = inner;
		}
		state.pos = end + 2;
		return true;
	});
	md.renderer.rules.janus_wikilink = (tokens, idx, options, env) => {
		const { target, alias } = tokens[idx].meta;
		const label = md.utils.escapeHtml(alias || target.split('/').pop());
		const wiki = env?.wiki;
		if (!wiki) return `<span class="janus-wikilink plain">${label}</span>`;
		// Auflösung lokal → Hubs macht env.wiki.resolve (siehe projects.js);
		// die einfache slugs/base-Form bleibt als Fallback unterstützt.
		let r;
		if (wiki.resolve) {
			r = wiki.resolve(target);
		} else {
			const known = wiki.slugs.has(target);
			r = { href: wiki.base + target.split('/').map(encodeURIComponent).join('/'), known };
		}
		const cls = 'janus-wikilink' + (r.known ? '' : ' rot') + (r.hub ? ' hub' : '');
		const title = !r.known
			? ' title="Seite existiert noch nicht – Klick legt sie an"'
			: r.hub
				? ` title="aus Wissens-Hub ${md.utils.escapeHtml(r.hub)}"`
				: '';
		return `<a class="${cls}" href="${r.href}"${title}>${label}</a>`;
	};
}

function linkPlugin(md) {
	const defaultOpen =
		md.renderer.rules.link_open ||
		((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

	md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		const hrefIndex = token.attrIndex('href');
		if (hrefIndex >= 0) {
			const href = token.attrs[hrefIndex][1];
			const isDoc = href.startsWith('doc:');
			const isDisk = href.startsWith('/') || href.startsWith('~') || href.startsWith('file:');
			if (isDoc || isDisk) {
				// markdown-it hat den href über normalizeLink prozentkodiert (Leerzeichen
				// → %20, Umlaute → UTF-8-Sequenzen); openTarget() braucht aber echte
				// Dateisystempfade. Der Traversal-Guard (resolveInDir) prüft erst nach
				// dem Dekodieren, ein kodiertes ".." bleibt also abgefangen.
				const target = md.utils.lib.mdurl.decode(isDoc ? href.slice(4) : href);
				token.attrs[hrefIndex][1] = '#';
				token.attrJoin('class', 'janus-doclink');
				token.attrSet('data-target', target);
				token.attrSet('data-kind', isDoc ? 'doc' : 'disk');
				token.attrSet('title', 'Auf der Festplatte öffnen: ' + target);
			}
		}
		return defaultOpen(tokens, idx, options, env, self);
	};
}

export function createMarkdown() {
	const md = new MarkdownIt({
		html: false,
		linkify: true,
		breaks: false,
		typographer: false
	});
	taskListPlugin(md);
	fencePlugin(md);
	wikilinkPlugin(md);
	linkPlugin(md);
	return md;
}

const shared = createMarkdown();

/**
 * Render a markdown string to HTML using the shared Janus renderer.
 * Optional env: { wiki: { slugs: Set<string>, base: string } } löst
 * [[wikilinks]] gegen die wissen/-Seiten eines Projekts auf.
 */
export function renderMarkdown(src, env = {}) {
	return shared.render(src || '', env);
}

/** Alle [[wikilink]]-Ziele eines Markdown-Strings (ohne Alias, ohne .md). */
export function collectWikilinks(src) {
	const out = [];
	const re = /\[\[([^[\]\n]+)\]\]/g;
	let m;
	while ((m = re.exec(src || ''))) {
		const inner = m[1];
		const sep = inner.indexOf('|');
		const target = (sep >= 0 ? inner.slice(0, sep) : inner).trim().replace(/\.md$/i, '');
		if (target) out.push(target);
	}
	return out;
}

/** Count GitHub task-list items in a markdown string: { done, total }. */
export function countTasks(src) {
	let done = 0;
	let total = 0;
	for (const line of (src || '').split('\n')) {
		const m = /^\s*[-*+]\s+\[([ xX])\]\s/.exec(line);
		if (m) {
			total++;
			if (m[1].toLowerCase() === 'x') done++;
		}
	}
	return { done, total };
}
