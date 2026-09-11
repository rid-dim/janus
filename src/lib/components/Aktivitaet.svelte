<script>
	/**
	 * Zustandsanzeige einer Agenten-Session auf der Projektkachel.
	 *
	 * Drei Zustände, drei verschiedene *Formen* – nicht nur drei Farben:
	 *
	 *   arbeitet → Perlen kreisen sichtbar
	 *   idle     → dieselben Perlen stehen still
	 *   wartet   → Ausrufezeichen
	 *
	 * Bewegung heißt „läuft, lass es laufen", Stillstand heißt „da ist jemand,
	 * aber nichts passiert", das Ausrufezeichen heißt „du bist dran". Dass die
	 * Formen sich unterscheiden und nicht bloß die Farben, ist Absicht: Farbe
	 * allein trägt die Aussage nicht, wenn jemand sie schlecht unterscheidet
	 * oder der Schirm sie verfälscht.
	 *
	 * @type {{ agent: any }}
	 */
	let { agent } = $props();

	const zustand = $derived(
		agent?.veraltet ? 'veraltet' : agent?.wartet ? 'wartet' : agent?.status === 'arbeitet' ? 'arbeitet' : 'idle'
	);

	const beschriftung = $derived(
		zustand === 'wartet'
			? 'Agent wartet auf Eingabe' + (agent?.frage ? ': ' + agent.frage : '')
			: zustand === 'arbeitet'
				? 'Agent arbeitet gerade hier'
				: zustand === 'veraltet'
					? 'Meldung veraltet – Session vermutlich abgebrochen'
					: 'Agent-Session offen, gerade untätig'
	);
</script>

<span class="anzeige {zustand}" title={beschriftung} aria-label={beschriftung} role="img">
	{#if zustand === 'wartet'}
		<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
			<path d="M12 4.5v9" stroke-width="3.2" stroke-linecap="round" />
			<circle cx="12" cy="18.8" r="1.8" stroke="none" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
			<g class="perlen">
				<circle cx="12" cy="4.6" r="2.7" stroke="none" />
				<circle cx="18.4" cy="15.7" r="2.7" stroke="none" />
				<circle cx="5.6" cy="15.7" r="2.7" stroke="none" />
			</g>
		</svg>
	{/if}
</span>

<style>
	.anzeige {
		flex: none;
		display: inline-flex;
		line-height: 0;
	}
	svg {
		overflow: visible;
	}
	circle,
	path {
		fill: currentColor;
		stroke: currentColor;
	}

	/* Kreisen heißt: hier läuft etwas. Die Drehung ist langsam genug, um am
	   Rand des Blickfelds nicht zu zappeln, und schnell genug, um als Bewegung
	   erkannt zu werden. */
	.arbeitet {
		color: var(--ok);
	}
	.arbeitet .perlen {
		transform-origin: 12px 12px;
		animation: kreisen 2.8s linear infinite;
	}
	.idle {
		color: var(--text-dim);
		opacity: 0.75;
	}
	.veraltet {
		color: var(--text-dim);
		opacity: 0.35;
	}
	.wartet {
		color: var(--kat-vorfall);
		animation: puls 1.7s ease-in-out infinite;
	}

	@keyframes kreisen {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes puls {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.arbeitet .perlen,
		.wartet {
			animation: none;
		}
	}
</style>
