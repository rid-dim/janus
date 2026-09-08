<script>
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} · Janus</title>
</svelte:head>

<main class="fehlerseite">
	<div class="karte">
		<div class="status">{page.status}</div>
		<h1>
			{#if page.status === 404}Nicht gefunden{:else}Da ist etwas schiefgegangen{/if}
		</h1>
		<p class="meldung">{page.error?.message || 'Unbekannter Fehler'}</p>
		<p class="hinweis">
			{#if page.status === 404}
				Die Adresse zeigt auf ein Projekt oder eine Seite, die es (nicht mehr) gibt. Lokal
				ausgeblendete Projekte sind per Direkt-URL weiterhin erreichbar – die ID muss aber
				zur <code>projekt.yaml</code> passen.
			{:else}
				Beim Einlesen der Projektdaten ist ein Fehler aufgetreten. Details stehen im
				Terminal, in dem Janus läuft.
			{/if}
		</p>
		<div class="aktionen">
			<a class="btn" href="/">Zur Übersicht</a>
			<button class="btn ghost" onclick={() => history.back()}>Zurück</button>
		</div>
	</div>
</main>

<style>
	.fehlerseite {
		min-height: calc(100vh - var(--topbar-h));
		display: grid;
		place-items: center;
		padding: 32px 20px;
	}
	.karte {
		max-width: 560px;
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 28px 30px;
	}
	.status {
		font-size: 12px;
		letter-spacing: 0.08em;
		color: var(--text-dim);
	}
	h1 {
		margin: 4px 0 12px;
		font-size: 22px;
	}
	.meldung {
		margin: 0 0 12px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 13px;
		background: var(--surface-2);
		padding: 8px 10px;
		border-radius: 8px;
		word-break: break-word;
	}
	.hinweis {
		margin: 0 0 18px;
		color: var(--text-dim);
		font-size: 14px;
		line-height: 1.5;
	}
	.aktionen {
		display: flex;
		gap: 10px;
	}
	.btn {
		font: inherit;
		font-size: 14px;
		padding: 7px 14px;
		border-radius: 8px;
		border: 1px solid var(--accent);
		background: var(--accent);
		color: #fff;
		text-decoration: none;
		cursor: pointer;
	}
	.btn.ghost {
		background: transparent;
		color: var(--text);
		border-color: var(--border);
	}
</style>
