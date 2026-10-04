<script lang="ts">
  import type { Climb } from '../../utils/climbs/climb.svelte';
  import type { ClimbStats } from '../../utils/climbs/geo';
  import { formatGrade, formatIndex, formatKm, formatM } from '../../utils/climbs/format';

  interface Props {
    a: Climb;
    b: Climb;
  }

  let { a, b }: Props = $props();

  const metrics: { label: string; key: keyof ClimbStats; format: (v: number) => string }[] = [
    { label: 'Dystans', key: 'length', format: formatKm },
    { label: 'Przewyższenie', key: 'gain', format: formatM },
    { label: 'Śr. nachylenie', key: 'avgGrade', format: formatGrade },
    { label: 'Maks. nachylenie', key: 'maxGrade', format: formatGrade },
    { label: 'Indeks FIETS', key: 'fiets', format: formatIndex },
  ];

  const sa = $derived(a.profile!.stats);
  const sb = $derived(b.profile!.stats);

  const verdict = $derived.by(() => {
    if (sa.fiets <= 0 || sb.fiets <= 0) return undefined;
    const [hard, easy, ratio] = sa.fiets >= sb.fiets ? [a, b, sa.fiets / sb.fiets] : [b, a, sb.fiets / sa.fiets];
    if (ratio < 1.1) return { text: 'Oba podjazdy są podobnie trudne.', climb: undefined };
    return {
      climb: hard,
      text: `jest ${formatIndex(ratio).replace(/,0$/, '')}× trudniejszy niż ${easy.label}.`,
    };
  });
</script>

<section class="rounded-3xl bg-ridetime-surface p-4 ring-1 ring-white/10 sm:p-6" aria-label="Porównanie podjazdów">
  {#if verdict}
    <p class="mb-4 text-sm text-slate-300">
      {#if verdict.climb}
        <strong class="font-semibold" style:color={verdict.climb.color}>{verdict.climb.label}</strong>
      {/if}
      {verdict.text}
      <span class="text-slate-500">(według indeksu FIETS)</span>
    </p>
  {/if}
  <dl class="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-5">
    {#each metrics as m (m.key)}
      <div class="bg-ridetime-surface px-4 py-3">
        <dt class="text-xs text-slate-400">{m.label}</dt>
        {#each [{ climb: a, value: sa[m.key], other: sb[m.key] }, { climb: b, value: sb[m.key], other: sa[m.key] }] as row (row.climb.id)}
          <dd
            class="mt-1.5 flex items-center gap-2 tabular-nums {row.value > row.other * 1.005
              ? 'font-semibold text-white'
              : 'text-slate-400'}">
            <span class="size-2 shrink-0 rounded-full" style:background={row.climb.color}></span>
            <span class="sr-only">{row.climb.label}:</span>
            {m.format(row.value)}
          </dd>
        {/each}
      </div>
    {/each}
  </dl>
</section>
