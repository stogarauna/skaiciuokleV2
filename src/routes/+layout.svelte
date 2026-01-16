<script lang="ts">
	import pkg from '../../package.json';
	const version: string = (pkg as any).version;
	const year = new Date().getFullYear();
</script>


<main class="min-h-screen bg-gray-100 flex flex-col items-center px-4 py-6" style="font-size: 1.8rem !important; line-height: 1 !important;">
	<div class="w-full max-w-md bg-white rounded-2xl shadow-lg p-5">
		<slot />
	</div>

	<footer class="text-center text-gray-500 mt-6">
		LED Skaičiuoklė © {year} · versija {version}
	</footer>
</main>
