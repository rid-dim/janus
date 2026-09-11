import { json } from '@sveltejs/kit';
import { schreiben, ansicht, nichtZugeordnet, trifft } from '$lib/server/kanal.js';
import { ladeAgenten, findeAgent } from '$lib/server/agenten.js';
import { registry } from '$lib/server/projects.js';
import { pruefeZugang } from '$lib/server/zugang.js';
import { menschName } from '$lib/server/config.js';

// Eine Nachricht in den Kanal werfen. Adressiert wird wie im Chat:
//   POST { text: "@q_backend @crm Wer kann den Testserver starten?" }
//   POST { text: "…", session: "<eigene session_id>" }   (als Agent)
//
// Eine Rundfrage ist kein eigener Mechanismus, sondern schlicht `@all` plus
// Frage. Antworten sind gewöhnliche Kanalnachrichten.
//
// Ohne Empfänger steht die Nachricht im Fenster, wird aber niemandem
// zugestellt – eine Notiz an den Kanal. Für eine Antwort an den Menschen ist
// genau das richtig: er liest mit, er pollt nicht.
export async function POST(event) {
	const zugang = pruefeZugang(event);
	if (!zugang.ok) return json({ ok: false, error: zugang.error }, { status: zugang.status });

	let body;
	try {
		body = await event.request.json();
	} catch {
		return json({ ok: false, error: 'Ungültiges JSON' }, { status: 400 });
	}

	const { text, empfaenger, thema, session } = body ?? {};
	if (typeof text !== 'string' || !text.trim()) {
		return json({ ok: false, error: 'Text fehlt' }, { status: 400 });
	}

	// Wer schreibt, wird aufgelöst – nicht geglaubt. Eine Session spricht nur
	// für ihr eigenes Projekt, und als Mensch gilt nur, wer aus der Oberfläche
	// kommt: ein vergessenes `session` darf nie dazu führen, dass eine Nachricht
	// so aussieht, als hätte der Mensch sie geschrieben.
	// Ein Post ohne Absender wurde bisher mit 200 quittiert und landete
	// absenderlos im Fenster – der Schreiber merkte nie, dass seine Nachricht
	// niemanden erreicht. Ein stiller Erfolg ist die schlechteste Antwort.
	if (!session && !event.request.headers.get('x-janus-ui')) {
		return json(
			{
				ok: false,
				error:
					'Feld "session" fehlt. Ein Agent schreibt so: ' +
					'{"session":"<deine session_id>","text":"@name …"}. ' +
					'Ohne session wüsste das Board nicht, wer schreibt – und die Nachricht ' +
					'erschiene absenderlos. Adressiert wird mit @name irgendwo im Text ' +
					'(@all an alle); ohne @ ist es eine Statusmeldung, die niemanden erreicht.'
			},
			{ status: 400 }
		);
	}

	const alleAgenten = ladeAgenten(registry());
	let von;
	let hinweis = null;
	if (session) {
		const { agent, mehrdeutig } = findeAgent(session, alleAgenten, trifft);
		if (mehrdeutig) {
			return json(
				{ ok: false, error: 'Die Kennung "' + session + '" passt auf mehrere Sessions: ' + mehrdeutig.join(', ') },
				{ status: 409 }
			);
		}
		if (agent) {
			von = { art: 'agent', name: agent.adresse ?? agent.projektId, projekt: agent.projektId, session: agent.sessionId };
		} else {
			von = { art: 'agent', name: 'unbekannte Session', projekt: null, session };
			hinweis =
				'Die Kennung "' + session + '" passt auf keine gemeldete Session – die Nachricht steht ' +
				'ohne Absender im Fenster. Nimm deine session_id, deinen Board-Namen oder deine Projekt-ID.';
		}
	} else {
		von = { art: 'mensch', name: menschName(), projekt: null };
	}

	try {
		const n = schreiben({
			text,
			empfaenger: Array.isArray(empfaenger) ? empfaenger : null,
			thema: thema ?? null,
			von
		});
		// Erwähnungen, die auf niemanden passen, ausdrücklich zurückmelden –
		// sonst merkt der Absender nicht, dass ein Teil seiner Nachricht ins
		// Leere ging. Kein Fehler: der Genannte kann später dazukommen.
		const offen = nichtZugeordnet(n.empfaenger, alleAgenten);
		return json({
			ok: true,
			id: n.id,
			von: von.name,
			empfaenger: n.empfaenger,
			...(offen.length ? { nichtZugeordnet: offen } : {}),
			...(hinweis ? { hinweis } : {})
		});
	} catch (e) {
		return json({ ok: false, error: String(e?.message || e) }, { status: 400 });
	}
}

// Der ganze Kanal, fertig gerendert – damit das Fenster häufig nachladen kann,
// ohne dafür das ganze Dashboard neu zu bauen (Registry, alle Projektdateien).
export function GET(event) {
	const zugang = pruefeZugang(event);
	if (!zugang.ok) return json({ ok: false, error: zugang.error }, { status: zugang.status });
	const reg = registry();
	return json({ ok: true, ...ansicht(reg, ladeAgenten(reg)) });
}
