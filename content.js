(function () {
    'use strict';

    const clone = (value) => JSON.parse(JSON.stringify(value));

    function merge(base, remote) {
        const output = clone(base);
        if (!remote || typeof remote !== 'object') return output;
        Object.keys(remote).forEach((key) => {
            const value = remote[key];
            if (value && typeof value === 'object' && !Array.isArray(value) && output[key] && !Array.isArray(output[key])) {
                output[key] = { ...output[key], ...value };
            } else if (value !== null && value !== undefined) {
                output[key] = value;
            }
        });
        return output;
    }

    function backendConfigured(config) {
        return config && /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl || '') &&
            config.supabaseAnonKey && !config.supabaseAnonKey.includes('YOUR_');
    }

    async function loadRemoteContent() {
        const config = window.ALEAF_BACKEND;
        if (!backendConfigured(config)) return null;

        const response = await fetch(`${config.supabaseUrl}/rest/v1/site_content?id=eq.main&select=content`, {
            headers: {
                apikey: config.supabaseAnonKey
            }
        });
        if (!response.ok) throw new Error(`content request failed (${response.status})`);
        const rows = await response.json();
        return rows[0]?.content || null;
    }

    function safeUrl(value, allowRelative = false) {
        if (!value) return '';
        try {
            const url = new URL(value, window.location.href);
            if (!['http:', 'https:'].includes(url.protocol)) return '';
            return allowRelative && !/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : url.href;
        } catch (_) {
            return '';
        }
    }

    function calculateAge(dateString) {
        const birth = new Date(`${dateString}T00:00:00`);
        if (Number.isNaN(birth.valueOf())) return '';
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const beforeBirthday = today.getMonth() < birth.getMonth() ||
            (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
        if (beforeBirthday) age -= 1;
        return Math.max(0, age);
    }

    function render(content) {
        const { site, profile, scrapbook, games, socials, theme } = content;
        document.title = site.title;
        document.querySelector('[data-content="profile-heading"]').textContent = site.profileHeading;
        document.querySelector('[data-content="games-heading"]').textContent = site.gamesHeading;
        document.querySelector('[data-content="quiz-heading"]').textContent = site.quizHeading;
        document.querySelector('[data-content="quiz-intro"]').textContent = site.quizIntro;

        const pfp = document.getElementById('pfp');
        pfp.src = safeUrl(site.profileImage, true) || window.ALEAF_DEFAULT_CONTENT.site.profileImage;

        const profileList = document.getElementById('profileFields');
        profileList.replaceChildren();
        (Array.isArray(profile) ? profile : []).forEach((field) => {
            const row = document.createElement('div');
            row.className = 'profile-row';
            const iconWrap = document.createElement('span');
            iconWrap.className = 'profile-field-icon';
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('class', 'icon ui-icon');
            icon.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            const iconMap = { AGE: 'i-clock', GENDER: 'i-user', SEXUALITY: 'i-heart', 'MONO/AMBI/POLY': 'i-link', PRONOUNS: 'i-comment', TIMEZONE: 'i-clock', 'ONLINE ACTIVITY': 'i-wifi', INTERESTS: 'i-star', HOBBIES: 'i-book', EXTRA: 'i-comment' };
            use.setAttribute('href', `#${iconMap[field.label] || 'i-user'}`);
            icon.append(use);
            iconWrap.append(icon);
            const label = document.createElement('span');
            label.className = 'profile-label';
            label.textContent = field.label;
            const value = document.createElement('span');
            value.className = 'profile-value';
            value.textContent = field.type === 'age' ? calculateAge(site.birthDate) : (field.value ?? '');
            row.append(iconWrap, label, value);
            profileList.append(row);
        });

        const scrapbookContent = scrapbook && typeof scrapbook === 'object' ? scrapbook : window.ALEAF_DEFAULT_CONTENT.scrapbook;
        document.querySelector('[data-content="scrapbook-heading"]').textContent = scrapbookContent.heading;
        const scrapbookItems = document.querySelector('.scrapbook-items');
        scrapbookItems.replaceChildren();
        const scrapbookIconMap = { game: 'i-game', book: 'i-book', volume: 'i-volume', star: 'i-star', moon: 'i-moon', heart: 'i-heart' };
        (Array.isArray(scrapbookContent.items) ? scrapbookContent.items : []).forEach((item) => {
            const card = document.createElement('div');
            card.className = 'scrapbook-item';
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('class', 'icon ui-icon');
            icon.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', `#${scrapbookIconMap[item.icon] || 'i-star'}`);
            icon.append(use);
            const label = document.createElement('span');
            label.textContent = item.label || '';
            const value = document.createElement('strong');
            value.textContent = item.value || '';
            card.append(icon, label, value);
            scrapbookItems.append(card);
        });
        const scrapbookImage = document.getElementById('scrapbookImage');
        scrapbookImage.src = safeUrl(scrapbookContent.image, true) || window.ALEAF_DEFAULT_CONTENT.scrapbook.image;
        scrapbookImage.alt = `${scrapbookContent.heading || 'Scrapbook'} accent`;
        document.getElementById('scrapbookCaption').textContent = scrapbookContent.caption;
        document.getElementById('scrapbookStamp').textContent = scrapbookContent.stamp;

        const gameList = document.querySelector('.game-images');
        gameList.replaceChildren();
        (Array.isArray(games) ? games : []).forEach((game) => {
            const imageUrl = safeUrl(game.image, true);
            const storeUrl = safeUrl(game.url);
            if (!imageUrl) return;
            const item = document.createElement(storeUrl ? 'a' : 'div');
            item.className = 'game-item';
            if (storeUrl) {
                item.href = storeUrl;
                item.target = '_blank';
                item.rel = 'noopener noreferrer';
            }
            const image = document.createElement('img');
            image.src = imageUrl;
            image.alt = game.title || 'Game';
            image.title = storeUrl ? `Click to view ${game.title || 'this game'}` : (game.title || 'Game');
            image.loading = 'lazy';
            const meta = document.createElement('span');
            meta.className = 'game-meta';
            const title = document.createElement('strong');
            title.textContent = game.title || 'Game';
            meta.append(title);
            if (storeUrl) {
                const external = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                external.setAttribute('class', 'icon ui-icon');
                external.setAttribute('aria-hidden', 'true');
                const externalUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                externalUse.setAttribute('href', '#i-external');
                external.append(externalUse);
                meta.append(external);
            }
            item.append(image, meta);
            gameList.append(item);
        });

        const socialMap = new Map((Array.isArray(socials) ? socials : []).map((item) => [item.id, item]));
        document.querySelectorAll('[data-social]').forEach((anchor) => {
            const item = socialMap.get(anchor.dataset.social);
            anchor.hidden = !item?.enabled;
            if (item?.enabled) {
                anchor.href = safeUrl(item.url) || '#';
                anchor.setAttribute('aria-label', item.label || item.id);
                const text = anchor.querySelector('span');
                if (text) text.textContent = item.label || item.id;
            }
        });

        document.querySelector('[data-page="library"]').hidden = !site.gamesEnabled;
        document.querySelector('[data-page="tests"]').hidden = !site.quizzesEnabled;
        document.querySelector('.links-panel').hidden = !site.socialsEnabled;
        document.querySelector('.scrapbook-panel').hidden = scrapbookContent.enabled === false;
        const music = document.getElementById('backgroundMusic');
        music.querySelector('source').src = safeUrl(site.musicUrl, true) || '';
        music.load();
        document.getElementById('musicToggle').hidden = !site.musicEnabled;

        const root = document.documentElement;
        Object.entries(theme || {}).forEach(([key, value]) => {
            if (/^#[0-9a-f]{6}$/i.test(value)) root.style.setProperty(`--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, value);
        });
    }

    window.ALEAF_CONTENT_READY = loadRemoteContent()
        .catch((error) => {
            console.warn('using built-in content:', error.message);
            return null;
        })
        .then((remote) => {
            const content = merge(window.ALEAF_DEFAULT_CONTENT, remote);
            window.ALEAF_CONTENT = content;
            render(content);
            return content;
        });
})();
