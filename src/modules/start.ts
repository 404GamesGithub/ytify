import player from '../lib/player';
import { params, state, store } from '../lib/store';
import { getDownloadLink, idFromURL, proxyHandler } from '../lib/utils';
import { bitrateSelector, searchFilters, superInput, audio, loadingScreen, searchlist } from '../lib/dom';
import fetchList from '../modules/fetchList';
import { fetchCollection } from "../lib/libraryUtils";
import '../scripts/library';
import '../scripts/queue';

export default async function() {

  const { customInstance, shareAction, HLS } = state;

  if (customInstance) {

    const [pi, iv, useInvidious] = customInstance.split(',');
    store.player.hls.api[0] =
      store.api.piped[0] = pi;
    store.api.invidious[0] = iv;
    store.player.usePiped = !useInvidious;

  } else await fetch('https://raw.githubusercontent.com/n-ce/Uma/main/dynamic_instances.json')
    .then(res => res.json())
    .then(data => {
      store.api.piped = data.piped;
      store.api.invidious = data.invidious;
      store.api.hyperpipe = data.hyperpipe;
      store.player.hls.api = data.hls;
      store.player.usePiped = data.status === 1;
      store.player.fallback = location.origin;
    });


  if (HLS) {
    // handling bitrates with HLS will increase complexity, better to detach from DOM
    bitrateSelector.remove();
    if (store.player.legacy) return;
    (await import('./hls')).default();
  } else
    bitrateSelector.addEventListener('change', async () => {
      if (store.player.playbackState === 'playing')
        audio.pause();
      const timeOfSwitch = audio.currentTime;
      audio.src = proxyHandler(bitrateSelector.value);
      audio.currentTime = timeOfSwitch;
      audio.play();
    });


  // params handling

  const isPWA = idFromURL(params.get('url') || params.get('text'));
  const id = params.get('s') || isPWA;

  if (id) {
    loadingScreen.showModal();
    if (isPWA && shareAction === 'watch') {
      store.actionsMenu.id = id;
      const dialog = document.createElement('dialog');
      dialog.open = true;
      dialog.className = 'watcher';
      document.body.appendChild(dialog);
      import('../components/WatchVideo.ts')
        .then(mod => mod.default(dialog));
    } else if (isPWA && shareAction) {
      const a = document.createElement('a');
      const l = await getDownloadLink(store.actionsMenu.id);
      if (l) {
        a.href = l;
        a.click();
      }
    } else await player(id)

    loadingScreen.close();
  }
  if (params.has('q')) {
    searchlist.innerHTML = '';
    superInput.value = params.get('q') || '';
    if (params.has('f'))
      searchFilters.value = params.get('f') || '';
    superInput.dispatchEvent(new KeyboardEvent('keydown', { 'key': 'Enter' }));
  }


  const collection = params.get('collection');
  const shared = params.get('si');
  const supermix = params.get('supermix');

  fetchCollection(collection || shared, Boolean(shared));
  if (supermix)
    import('./supermix').then(mod => mod.default(supermix.split(' ')));

  // list loading

  if (params.has('channel') || params.has('playlists'))
    fetchList('/' +
      location.search
        .substring(1)
        .split('=')
        .join('/')
    );

  // header state handling
  (document.querySelectorAll('header details') as NodeListOf<HTMLDetailsElement>).forEach(d => {
    d.addEventListener('click', (e) => {
      const elm = e.target as HTMLElement;
      // TODO
      if (!elm.matches('i') && d.open)
        d.removeAttribute('open');
    })
  })

}
