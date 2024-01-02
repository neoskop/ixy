<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let data: { [key: string]: any } = {};
	let highestContent = {
		source: {
			count: 0,
			size: 0
		},
		target: {
			count: 0,
			size: 0
		}
	};
	let sortedPodNames: string[] = [];

	async function fetchData() {
		try {
			const response = await fetch('/api/cache/all');
			data = await response.json();
			sortedPodNames = Object.keys(data).sort();
			sortedPodNames.forEach((podName) => {
				const podData = data[podName];

				if (podData.phase === 'Running' && podData.ready) {
					highestContent.source.count = Math.max(highestContent.source.count, podData.source.count);
					highestContent.source.size = Math.max(highestContent.source.size, podData.source.size);
					highestContent.target.count = Math.max(highestContent.target.count, podData.target.count);
					highestContent.target.size = Math.max(highestContent.target.size, podData.target.size);
				}
			});
		} catch (error) {
			console.error('Error fetching data:', error);
		}
	}

	const interval = setInterval(async () => {
		fetchData();
	}, 500);

	onMount(async () => {
		fetchData();
	});

	onDestroy(() => clearInterval(interval));
</script>

<div id="app" class="cards">
	{#each sortedPodNames as podName}
		{#if data[podName].phase === 'Running' && data[podName].ready}
			<div
				class="card {data[podName].phase.toLowerCase()} {data[podName].ready
					? 'ready'
					: 'not-ready'}"
			>
				<h2 class="card-header">
					<p class="card-header-title">{podName}</p>
				</h2>
				{#if data[podName].phase === 'Running' && data[podName].ready}
					<div>
						<h3>Source</h3>
						<ul>
							<li class:low={data[podName].source.count < highestContent.source.count}>
								<p>{data[podName].source.count}</p>
								<footer>#</footer>
							</li>
							<li class:low={data[podName].source.size < highestContent.source.size}>
								<p>{data[podName].source.size}</p>
								<footer>{data[podName].source.size / 1024 > 1024 ? 'MB' : 'KB'}</footer>
							</li>
						</ul>
					</div>
					<div>
						<h3>Target</h3>
						<ul>
							<li class:low={data[podName].target.count < highestContent.target.count}>
								<p>{data[podName].target.count}</p>
								<footer>#</footer>
							</li>
							<li class:low={data[podName].target.size < highestContent.target.size}>
								<p>{data[podName].target.size}</p>
								<footer>{data[podName].target.size / 1024 > 1024 ? 'MB' : 'KB'}</footer>
							</li>
						</ul>
					</div>
				{/if}
			</div>
		{/if}
	{/each}
</div>
