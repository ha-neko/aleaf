(function () {
    'use strict';

    const pages = ['profile', 'library', 'tests', 'web'];
    const fileNames = { profile: 'home', library: 'games', tests: 'quiz', web: 'browser' };
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const panels = [...document.querySelectorAll('[data-page-panel]')];
    const addressInput = document.getElementById('addressInput');
    const webTabShell = document.getElementById('webTabShell');
    const webTabTitle = document.getElementById('webTabTitle');
    const webFrame = document.getElementById('webFrame');
    const webFrameLabel = document.getElementById('webFrameLabel');
    const openExternal = document.getElementById('openExternal');
    const backButton = document.getElementById('browserBack');
    const forwardButton = document.getElementById('browserForward');
    let currentPage = 'profile';
    let previousContentPage = 'profile';
    let currentWebDisplay = '';
    let webEntries = [];
    let webIndex = -1;
    let navigationPosition = Number.isInteger(history.state?.navigationPosition) ? history.state.navigationPosition : 0;
    let navigationExtent = navigationPosition;

    try {
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !sessionStorage.getItem('aleaf-booted')) {
            document.body.classList.add('booting');
            sessionStorage.setItem('aleaf-booted', 'true');
            requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('booting')));
        }
    } catch (_) {
        // Storage can be unavailable in privacy modes; the reveal is non-essential.
    }

    const nightSky = document.querySelector('.signal-stars');
    function randomizeStar(star) {
        const colors = ['#fff8fc', '#fff8fc', '#fff8fc', '#f8e8f2', '#f3b7c8', '#e7dcf5'];
        const duration = 3.8 + Math.random() * 5.8;
        const size = Math.random() < .82 ? .8 + Math.random() * 1.1 : 1.9 + Math.random() * .9;
        star.style.setProperty('--star-x', `${2 + Math.random() * 96}%`);
        star.style.setProperty('--star-y', `${3 + Math.random() * 94}%`);
        star.style.setProperty('--star-size', `${size.toFixed(1)}px`);
        star.style.setProperty('--star-glow', `${2 + Math.random() * 4}px`);
        star.style.setProperty('--star-color', colors[Math.floor(Math.random() * colors.length)]);
        star.style.setProperty('--star-low', (0.06 + Math.random() * 0.12).toFixed(2));
        star.style.setProperty('--star-opacity', (0.34 + Math.random() * 0.48).toFixed(2));
        star.style.setProperty('--star-duration', `${duration.toFixed(2)}s`);
        star.style.setProperty('--star-delay', `${(-Math.random() * duration).toFixed(2)}s`);
    }
    if (nightSky) {
        const starCount = window.matchMedia('(max-width: 640px)').matches ? 22 : 34;
        const stars = document.createDocumentFragment();
        for (let index = 0; index < starCount; index += 1) {
            const star = document.createElement('i');
            randomizeStar(star);
            stars.append(star);
        }
        nightSky.replaceChildren(stars);
    }

    function validPage(value) {
        const aliases = { home: 'profile', games: 'library', quiz: 'tests' };
        value = aliases[value] || value;
        if (value === 'admin') return 'admin';
        if (!pages.includes(value)) return 'profile';
        const tab = document.querySelector(`[data-page="${value}"]`);
        return tab && !tab.hidden && !tab.closest('[hidden]') ? value : 'profile';
    }

    function visibleTabs() {
        return tabs.filter((tab) => !tab.hidden && !tab.closest('[hidden]'));
    }

    function updateWebNavigation() {
        backButton.disabled = navigationPosition <= 0;
        forwardButton.disabled = navigationPosition >= navigationExtent;
    }

    function pushNavigationState(state, url) {
        navigationPosition += 1;
        navigationExtent = navigationPosition;
        history.pushState({ ...state, navigationPosition }, '', url);
    }

    function activate(page, updateHash = true) {
        page = validPage(page);
        if (page === 'admin') {
            window.location.href = 'admin/index.html';
            return;
        }
        const pageChanged = currentPage !== page;
        currentPage = page;
        if (page !== 'web') previousContentPage = page;
        tabs.forEach((tab) => {
            const active = tab.dataset.page === page;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
        });
        panels.forEach((panel) => { panel.hidden = panel.dataset.pagePanel !== page; });
        document.getElementById('pageStatusText').textContent = `${page === 'web' ? (webFrameLabel.textContent || 'browser') : fileNames[page]} loaded`;
        addressInput.value = page === 'web' ? currentWebDisplay : `aleaf.me/#${fileNames[page]}`;
        if (updateHash && (pageChanged || location.hash !== `#${page}`)) pushNavigationState({ page }, `#${page}`);
        document.title = `${page === 'web' ? webTabTitle.textContent : fileNames[page]} · ${window.ALEAF_CONTENT?.site?.title || 'aleaf'}`;
        updateWebNavigation();
    }

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activate(tab.dataset.page));
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const availableTabs = visibleTabs();
            const visibleIndex = availableTabs.indexOf(tab);
            let next = visibleIndex;
            if (event.key === 'ArrowLeft') next = (visibleIndex - 1 + availableTabs.length) % availableTabs.length;
            if (event.key === 'ArrowRight') next = (visibleIndex + 1) % availableTabs.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = availableTabs.length - 1;
            availableTabs[next].focus();
            activate(availableTabs[next].dataset.page);
        });
    });

    function classifyAddress(rawValue) {
        const value = rawValue.trim();
        const lower = value.toLowerCase().replace(/\/+$/, '');
        const internalPages = { home: 'profile', '#home': 'profile', games: 'library', '#games': 'library', quiz: 'tests', '#quiz': 'tests' };
        const internalKey = lower.replace(/^aleaf\.me\//, '');
        if (internalPages[internalKey]) return { internal: internalPages[internalKey] };
        if (/^(admin|admin\/|aleaf\.me\/admin|localhost(?::\d+)?\/admin)$/.test(lower)) {
            return { internal: 'admin' };
        }
        if (lower === 'youtube') {
            return { url: 'https://www.youtube.com/', externalUrl: 'https://www.youtube.com/', display: 'youtube', title: 'youtube', blocked: true, host: 'youtube.com' };
        }
        const youtubeSearch = value.match(/^youtube\s+(.+)$/i);
        if (youtubeSearch) {
            const query = youtubeSearch[1].trim();
            return {
                url: `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}`,
                externalUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
                display: `youtube ${query}`,
                title: `youtube · ${query.slice(0, 14)}`
            };
        }
        if (/^https?:\/\//i.test(value) || /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#].*)?$/i.test(value)) {
            const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
            try {
                const url = new URL(candidate);
                if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
                const host = url.hostname.replace(/^www\./, '');
                if (['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
                    let videoId = host === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v');
                    if (!videoId && /^\/(?:shorts|embed)\//.test(url.pathname)) videoId = url.pathname.split('/')[2];
                    if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
                        return { url: `https://www.youtube-nocookie.com/embed/${videoId}`, externalUrl: url.href, display: url.href, title: 'youtube video' };
                    }
                    return { url: url.href, externalUrl: url.href, display: url.href, title: 'youtube', blocked: true, host: 'youtube.com' };
                }
                const blockedHosts = ['instagram.com', 'x.com', 'twitter.com', 'github.com', 'facebook.com', 'tiktok.com'];
                return { url: url.href, externalUrl: url.href, display: url.href, title: host.slice(0, 22), blocked: blockedHosts.includes(host), host };
            } catch (_) {
                // Invalid addresses become searches instead of dead ends.
            }
        }
        return {
            url: `https://www.google.com/search?igu=1&q=${encodeURIComponent(value)}`,
            display: value,
            title: value.length > 20 ? `${value.slice(0, 20)}…` : (value || 'search')
        };
    }

    function escapeMarkup(value) {
        return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
    }

    function blockedFrameDocument(entry) {
        const host = escapeMarkup(entry.host || entry.title || 'this website');
        const url = escapeMarkup(entry.externalUrl || entry.url);
        return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:28px;color:#3a2436;background:radial-gradient(circle at 80% 10%,rgba(243,183,200,.45),transparent 16rem),linear-gradient(145deg,#fff8fc,#f4e6ef);font:15px/1.6 system-ui,sans-serif}.card{width:min(520px,100%);padding:34px;text-align:center;border:1px solid #ddb9d0;border-radius:22px;background:rgba(255,255,255,.82);box-shadow:0 18px 45px rgba(86,42,73,.13)}.mark{width:58px;height:58px;margin:auto;display:grid;place-items:center;border-radius:50%;color:white;background:linear-gradient(145deg,#c15f94,#6b2c78);font-size:24px}h1{margin:16px 0 7px;font:600 italic 34px Georgia,serif}p{margin:0 auto 20px;max-width:410px;color:#806778}a{min-height:44px;padding:0 20px;display:inline-flex;align-items:center;border-radius:999px;color:white;background:linear-gradient(135deg,#b94f89,#6b2c78);text-decoration:none;font-weight:700}.hint{display:block;margin-top:15px;color:#9a718b;font-size:11px}</style></head><body><main class="card"><div class="mark">↗</div><h1>${host} prefers its own window</h1><p>This site blocks embedded browsers for security. Nothing broke. It is merely being dramatic.</p><a href="${url}" target="_blank" rel="noopener noreferrer">open ${host}</a><span class="hint">YouTube video links are embedded automatically when possible.</span></main></body></html>`;
    }

    function loadWebEntry(entry, addToHistory = true) {
        if (addToHistory) {
            webEntries = webEntries.slice(0, webIndex + 1);
            webEntries.push(entry);
            webIndex = webEntries.length - 1;
        }
        currentWebDisplay = entry.display;
        webTabTitle.textContent = entry.title;
        webFrameLabel.textContent = entry.title === 'control room' ? 'admin · local session' : `viewing · ${entry.title}`;
        webFrame.title = `${entry.title} browser tab`;
        openExternal.href = entry.externalUrl || entry.url;
        if (entry.blocked) {
            webFrame.src = 'about:blank';
            webFrame.srcdoc = blockedFrameDocument(entry);
        } else {
            webFrame.removeAttribute('srcdoc');
            webFrame.src = entry.url;
        }
        webTabShell.hidden = false;
        activate('web', false);
        if (addToHistory) pushNavigationState({ page: 'web', webEntry: entry, webIndex }, '#web');
        document.getElementById('tab-web').focus({ preventScroll: true });
    }

    document.getElementById('addressForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const destination = classifyAddress(addressInput.value);
        if (destination.internal) activate(destination.internal);
        else loadWebEntry(destination);
    });

    addressInput.addEventListener('focus', () => addressInput.select());
    addressInput.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            addressInput.value = currentPage === 'web' ? currentWebDisplay : `aleaf.me/#${fileNames[currentPage]}`;
            addressInput.blur();
        }
    });

    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
            event.preventDefault();
            addressInput.focus();
        }
    });

    document.getElementById('closeWebTab').addEventListener('click', () => {
        webTabShell.hidden = true;
        webFrame.src = 'about:blank';
        webEntries = [];
        webIndex = -1;
        currentWebDisplay = '';
        activate(previousContentPage || 'profile');
        document.querySelector(`[data-page="${currentPage}"]`)?.focus();
    });

    backButton.addEventListener('click', () => { if (navigationPosition > 0) history.back(); });
    forwardButton.addEventListener('click', () => { if (navigationPosition < navigationExtent) history.forward(); });

    webFrame.addEventListener('load', () => {
        if (currentPage === 'web' && webFrame.src !== 'about:blank') {
            document.getElementById('pageStatusText').textContent = `${webTabTitle.textContent} loaded in frame`;
        }
    });

    window.addEventListener('popstate', (event) => {
        if (Number.isInteger(event.state?.navigationPosition)) navigationPosition = event.state.navigationPosition;
        if (event.state?.page === 'web' && event.state.webEntry) {
            webIndex = Number.isInteger(event.state.webIndex) ? event.state.webIndex : webIndex;
            loadWebEntry(event.state.webEntry, false);
        } else {
            activate(event.state?.page || location.hash.slice(1), false);
        }
        updateWebNavigation();
    });
    const initialPage = validPage(location.hash.slice(1));
    history.replaceState({ ...(history.state || {}), page: initialPage, navigationPosition }, '', location.href);
    activate(initialPage, false);
    (window.ALEAF_CONTENT_READY || Promise.resolve()).then(() => activate(location.hash.slice(1), false));

    const music = document.getElementById('backgroundMusic');
    const toggle = document.getElementById('musicToggle');
    const musicStatus = document.getElementById('musicStatus');
    function setMusicState(playing, message) {
        toggle.setAttribute('aria-pressed', String(playing));
        toggle.setAttribute('aria-label', playing ? 'Pause background music' : 'Play background music');
        musicStatus.textContent = message || `Background music ${playing ? 'playing' : 'paused'}`;
    }
    toggle.addEventListener('click', async () => {
        if (music.paused) {
            try {
                await music.play();
                setMusicState(true);
            } catch (error) {
                setMusicState(false, 'Background music could not be played');
                console.warn('audio could not start:', error.message);
            }
        } else {
            music.pause();
            setMusicState(false);
        }
    });
    music.addEventListener('error', () => setMusicState(false, 'Background music is unavailable'));
    music.addEventListener('pause', () => setMusicState(false));

    document.getElementById('refreshPage').addEventListener('click', () => {
        if (currentPage === 'web' && webEntries[webIndex]) {
            loadWebEntry(webEntries[webIndex], false);
            document.getElementById('pageStatusText').textContent = 'browser refreshed';
        } else {
            activate(currentPage, false);
            document.getElementById('pageStatusText').textContent = `${fileNames[currentPage]} refreshed`;
        }
    });

    const clock = document.getElementById('desktopClock');
    function updateClock() {
        const now = new Date();
        clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        clock.parentElement.setAttribute('aria-label', `Local time ${clock.textContent}`);
    }
    updateClock();
    window.setInterval(updateClock, 30000);

    const presence = document.getElementById('discordPresence');
    async function loadDiscordPresence() {
        if (!presence) return;
        const userId = presence.dataset.discordId;
        try {
            const response = await fetch(`https://api.lanyard.rest/v1/users/${userId}`);
            if (!response.ok) throw new Error(`request failed (${response.status})`);
            const payload = await response.json();
            if (!payload.success || !payload.data) throw new Error('presence unavailable');

            const data = payload.data;
            const user = data.discord_user;
            const avatar = document.getElementById('discordAvatar');
            const avatarExtension = user.avatar?.startsWith('a_') ? 'gif' : 'png';
            avatar.src = user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${avatarExtension}?size=128`
                : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
            avatar.alt = `${user.global_name || user.username}'s Discord avatar`;
            avatar.hidden = false;

            document.getElementById('discordName').textContent = user.global_name || user.username;
            document.getElementById('discordHandle').textContent = `@${user.username} · ${data.discord_status || 'offline'}`;
            const customStatus = data.activities.find((item) => item.type === 4)?.state || '';
            document.getElementById('discordCustomStatus').textContent = customStatus;
            document.getElementById('discordCustomStatus').hidden = !customStatus;
            const dot = document.getElementById('discordStatusDot');
            dot.className = `presence-dot ${data.discord_status || 'offline'}`;

            const activityRoot = document.getElementById('discordActivities');
            activityRoot.replaceChildren();
            const activities = data.activities.filter((item) => item.type !== 4);

            if (data.listening_to_spotify && data.spotify) {
                const card = document.createElement('div');
                card.className = 'activity-card spotify-activity';
                const art = document.createElement('img');
                art.src = data.spotify.album_art_url;
                art.alt = '';
                const copy = document.createElement('div');
                const label = document.createElement('span');
                label.textContent = 'Listening to Spotify';
                const title = document.createElement('strong');
                title.textContent = data.spotify.song;
                const detail = document.createElement('p');
                detail.textContent = `by ${data.spotify.artist}`;
                copy.append(label, title, detail);
                card.append(art, copy);
                activityRoot.append(card);
            }

            const visibleActivities = activities.filter((item) => item.name !== 'Spotify').slice(0, 2);
            visibleActivities.forEach((activity) => {
                const card = document.createElement('div');
                card.className = 'activity-card';
                if (activity.assets?.large_image) {
                    const art = document.createElement('img');
                    const asset = activity.assets.large_image;
                    if (asset.startsWith('mp:')) art.src = `https://media.discordapp.net/${asset.slice(3)}`;
                    else if (asset.startsWith('http')) art.src = asset;
                    else if (activity.application_id) art.src = `https://cdn.discordapp.com/app-assets/${activity.application_id}/${asset}.png`;
                    if (art.src) {
                        art.alt = '';
                        card.append(art);
                    }
                }
                const copy = document.createElement('div');
                const label = document.createElement('span');
                label.textContent = activity.type === 0 ? 'Playing' : activity.type === 2 ? 'Listening to' : activity.type === 3 ? 'Watching' : 'Activity';
                const title = document.createElement('strong');
                title.textContent = activity.name;
                copy.append(label, title);
                if (activity.details || activity.state) {
                    const detail = document.createElement('p');
                    detail.textContent = [activity.details, activity.state].filter(Boolean).join(' · ');
                    copy.append(detail);
                }
                card.append(copy);
                activityRoot.append(card);
            });

            if (!activityRoot.children.length) {
                const empty = document.createElement('p');
                empty.className = 'activity-empty';
                empty.textContent = customStatus || (data.discord_status === 'offline' ? 'Offline · no public activity' : 'Online · no public activity');
                activityRoot.append(empty);
            } else if (activities.filter((item) => item.name !== 'Spotify').length > visibleActivities.length) {
                const more = document.createElement('p');
                more.className = 'activity-more';
                more.textContent = `+${activities.filter((item) => item.name !== 'Spotify').length - visibleActivities.length} more activity`;
                activityRoot.append(more);
            }
        } catch (error) {
            document.getElementById('discordName').textContent = 'Discord unavailable';
            document.getElementById('discordHandle').textContent = 'Presence unavailable';
            document.getElementById('discordCustomStatus').hidden = true;
            document.getElementById('discordActivities').textContent = 'Could not load rich presence';
            console.warn('lanyard presence:', error.message);
        }
    }
    loadDiscordPresence();
    window.setInterval(() => {
        if (!document.hidden) loadDiscordPresence();
    }, 60000);
})();
