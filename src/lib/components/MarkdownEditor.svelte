<script>
	/** @type {{ value?: string, busy?: boolean, placeholder?: string,
	 *           onsave: (text: string) => void, oncancel?: () => void }} */
	let { value = '', busy = false, placeholder = '', onsave, oncancel } = $props();

	let text = $state(value);

	function keydown(e) {
		// Cmd/Ctrl+Enter saves, Esc cancels – handy for quick edits.
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			onsave(text);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			oncancel?.();
		}
	}
</script>

<div class="md-editor">
	<textarea
		bind:value={text}
		{placeholder}
		spellcheck="false"
		onkeydown={keydown}
	></textarea>
	<div class="md-editor-actions">
		<button class="primary" disabled={busy} onclick={() => onsave(text)}>Speichern</button>
		<button disabled={busy} onclick={() => oncancel?.()}>Abbrechen</button>
		<span class="hint">⌘/Ctrl+↵ speichert · Esc bricht ab</span>
	</div>
</div>

<style>
	.md-editor {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	textarea {
		width: 100%;
		min-height: 220px;
		resize: vertical;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg);
		color: var(--text);
		font-family: var(--mono);
		font-size: 13px;
		line-height: 1.6;
		tab-size: 2;
	}
	textarea:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
	}
	.md-editor-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	button {
		padding: 6px 14px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	button.primary {
		border-color: var(--accent);
		background: var(--accent);
		color: #fff;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.hint {
		font-size: 11.5px;
		color: var(--text-dim);
		margin-left: auto;
	}
</style>
