(function () {
    'use strict';

    const config = window.ALEAF_BACKEND || {};
    const configured = /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl || '') &&
        config.supabaseAnonKey && !config.supabaseAnonKey.includes('YOUR_') && window.supabase;
    const guestbookStatus = document.getElementById('guestbookListStatus');
    const galleryStatus = document.getElementById('galleryStatus');
    const visitorStatus = document.getElementById('visitorStatus');

    function setStatus(element, message, error = false) {
        if (!element) return;
        element.textContent = message;
        element.classList.toggle('is-error', error);
    }

    function disableForms(message) {
        ['inboxForm'].forEach((id) => {
            const form = document.getElementById(id);
            if (!form) return;
            [...form.elements].forEach((control) => { control.disabled = true; });
            setStatus(form.querySelector('.form-status'), message, true);
        });
        const guestbookOpen = document.getElementById('guestbookOpen');
        if (guestbookOpen) guestbookOpen.disabled = true;
        setStatus(document.getElementById('guestbookSubmissionStatus'), message, true);
    }

    function safePublicUrl(value) {
        try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch (_) {
            return '';
        }
    }

    function displayDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.valueOf())) return '';
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function isApproved(entry) {
        if ('approved' in entry) return entry.approved === true;
        if ('is_approved' in entry) return entry.is_approved === true;
        if ('status' in entry) return entry.status === 'approved';
        return true;
    }

    function isPublished(item) {
        if ('published' in item) return item.published === true;
        if ('is_published' in item) return item.is_published === true;
        if ('status' in item) return item.status === 'published';
        return true;
    }

    async function loadGuestbook(client) {
        const root = document.getElementById('guestbookEntries');
        try {
            const { data, error } = await client.from('guestbook_entries').select('*').eq('approved', true).order('created_at', { ascending: false });
            if (error) throw error;
            const entries = (Array.isArray(data) ? data : []).filter(isApproved);
            root.replaceChildren();
            entries.forEach((entry) => {
                const article = document.createElement('article');
                article.className = 'guestbook-entry';
                const heading = document.createElement('div');
                const name = document.createElement('strong');
                name.textContent = entry.display_name || 'anonymous visitor';
                const time = document.createElement('time');
                const dateText = displayDate(entry.created_at);
                time.textContent = dateText;
                if (entry.created_at) time.dateTime = entry.created_at;
                time.hidden = !dateText;
                heading.append(name, time);
                const body = document.createElement('p');
                body.textContent = entry.body || entry.message || '';
                article.append(heading, body);
                root.append(article);
            });
            setStatus(guestbookStatus, entries.length ? `${entries.length} approved ${entries.length === 1 ? 'entry' : 'entries'}.` : 'No approved entries yet. Be the first to leave a note.');
            guestbookStatus.classList.toggle('is-empty', entries.length === 0);
        } catch (error) {
            root.replaceChildren();
            setStatus(guestbookStatus, 'The guestbook could not be loaded right now.', true);
            console.warn('guestbook:', error.message);
        }
    }

    async function loadGallery(client) {
        const root = document.getElementById('galleryItems');
        try {
            const { data, error } = await client.from('gallery_items').select('*').eq('published', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false });
            if (error) throw error;
            const items = (Array.isArray(data) ? data : []).filter(isPublished).filter((item) => safePublicUrl(item.public_url));
            root.replaceChildren();
            items.forEach((item) => {
                const figure = document.createElement('figure');
                figure.className = 'gallery-item';
                const image = document.createElement('img');
                image.src = safePublicUrl(item.public_url);
                image.alt = item.alt_text || item.alt || item.title || 'Published gallery item';
                image.loading = 'lazy';
                const titleText = item.title || '';
                const captionText = item.caption || item.description || '';
                if (titleText || captionText) {
                    const caption = document.createElement('figcaption');
                    if (titleText) {
                        const title = document.createElement('strong');
                        title.textContent = titleText;
                        caption.append(title);
                    }
                    if (captionText) {
                        const description = document.createElement('span');
                        description.textContent = captionText;
                        caption.append(description);
                    }
                    figure.append(image, caption);
                } else {
                    figure.append(image);
                }
                root.append(figure);
            });
            setStatus(galleryStatus, items.length ? `${items.length} published ${items.length === 1 ? 'piece' : 'pieces'}.` : 'The gallery is quiet for now. Published pieces will appear here.');
            galleryStatus.classList.toggle('is-empty', items.length === 0);
        } catch (error) {
            root.replaceChildren();
            setStatus(galleryStatus, 'The gallery could not be loaded right now.', true);
            console.warn('gallery:', error.message);
        }
    }

    function bindRpcForm(client, options) {
        const form = document.getElementById(options.formId);
        const status = document.getElementById(options.statusId);
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            const values = options.values(form);
            if (Object.values(values).some((value) => value.required && !value.text.trim())) {
                setStatus(status, 'Please complete the required fields.', true);
                return;
            }
            const button = form.querySelector('button[type="submit"]');
            button.disabled = true;
            setStatus(status, options.loading);
            const parameters = {};
            Object.entries(values).forEach(([key, value]) => { parameters[key] = value.text.trim(); });
            try {
                const { error } = await client.rpc(options.rpc, parameters);
                if (error) throw error;
                form.reset();
                setStatus(status, options.success);
            } catch (error) {
                setStatus(status, options.failure, true);
                console.warn(`${options.rpc}:`, error.message);
            } finally {
                button.disabled = false;
            }
        });
    }

    function bindGuestbookDialog(client) {
        const dialog = document.getElementById('guestbookDialog');
        const form = document.getElementById('guestbookForm');
        const openButton = document.getElementById('guestbookOpen');
        const closeButton = document.getElementById('guestbookClose');
        const cancelButton = document.getElementById('guestbookCancel');
        const refreshButton = document.getElementById('guestbookCaptchaRefresh');
        const choicesRoot = document.getElementById('guestbookCaptchaChoices');
        const captchaStatus = document.getElementById('guestbookCaptchaStatus');
        const formStatus = document.getElementById('guestbookFormStatus');
        const submissionStatus = document.getElementById('guestbookSubmissionStatus');
        const submitButton = form.querySelector('button[type="submit"]');
        let challenge = null;
        let challengeRequest = 0;

        async function loadChallenge() {
            const request = ++challengeRequest;
            challenge = null;
            choicesRoot.replaceChildren();
            submitButton.disabled = true;
            refreshButton.disabled = true;
            setStatus(captchaStatus, 'Loading verification images...');
            try {
                const { data, error } = await client.rpc('issue_guestbook_captcha');
                if (error) throw error;
                if (request !== challengeRequest || !dialog.open) return;
                if (!data || !data.challenge_id || !Array.isArray(data.choices) || data.choices.length !== 6) {
                    throw new Error('Invalid CAPTCHA challenge');
                }
                const fragment = document.createDocumentFragment();
                data.choices.forEach((choice, index) => {
                    if (!choice || !choice.token || !choice.asset_path) throw new Error('Invalid CAPTCHA choice');
                    const label = document.createElement('label');
                    label.className = 'captcha-choice';
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.name = 'captcha_choice';
                    checkbox.value = choice.token;
                    const visual = document.createElement('span');
                    visual.className = 'captcha-choice-visual';
                    const image = document.createElement('img');
                    image.src = new URL(choice.asset_path, window.location.href).href;
                    image.alt = `Verification image ${index + 1}`;
                    visual.append(image);
                    label.append(checkbox, visual);
                    fragment.append(label);
                });
                challenge = {
                    id: data.challenge_id,
                    expiresAt: data.expires_at || data.expiry ? new Date(data.expires_at || data.expiry).valueOf() : null
                };
                choicesRoot.append(fragment);
                setStatus(captchaStatus, 'Verification images ready.');
                submitButton.disabled = false;
            } catch (error) {
                if (request !== challengeRequest || !dialog.open) return;
                setStatus(captchaStatus, 'Verification images could not be loaded. Please refresh them.', true);
                console.warn('issue_guestbook_captcha:', error.message);
            } finally {
                if (request === challengeRequest) refreshButton.disabled = false;
            }
        }

        openButton.addEventListener('click', () => {
            if (dialog.open) return;
            setStatus(submissionStatus, '');
            setStatus(formStatus, '');
            dialog.showModal();
            loadChallenge();
        });
        refreshButton.addEventListener('click', () => {
            setStatus(formStatus, '');
            loadChallenge();
        });
        closeButton.addEventListener('click', () => dialog.close());
        cancelButton.addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => {
            challengeRequest += 1;
            challenge = null;
            choicesRoot.replaceChildren();
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            const selectedTokens = [...form.elements.captcha_choice || []]
                .filter((choice) => choice.checked)
                .map((choice) => choice.value);
            if (!challenge || (challenge.expiresAt && challenge.expiresAt <= Date.now())) {
                setStatus(formStatus, 'Verification expired. Please complete the new challenge.', true);
                loadChallenge();
                return;
            }
            if (!selectedTokens.length) {
                setStatus(formStatus, 'Select every matching image before sending.', true);
                return;
            }

            submitButton.disabled = true;
            refreshButton.disabled = true;
            setStatus(formStatus, 'Sending your note...');
            try {
                const { data, error } = await client.rpc('submit_guestbook_entry', {
                    p_display_name: form.elements.display_name.value.trim(),
                    p_message: form.elements.body.value.trim(),
                    p_challenge_id: challenge.id,
                    p_selected_tokens: selectedTokens
                });
                if (error) throw error;
                if (data === null || data === false || data === '' || (typeof data === 'object' && data.success === false)) {
                    throw new Error('Submission was rejected');
                }
                form.reset();
                dialog.close();
                setStatus(submissionStatus, 'Note received. It will appear after approval.');
            } catch (error) {
                setStatus(formStatus, 'Your note could not be sent. Please try the new verification images.', true);
                console.warn('submit_guestbook_entry:', error.message);
                await loadChallenge();
            }
        });
    }

    function visitorId() {
        const key = 'aleaf-visitor-id';
        const create = () => {
            if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            bytes[6] = (bytes[6] & 15) | 64;
            bytes[8] = (bytes[8] & 63) | 128;
            const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        };
        try {
            const stored = localStorage.getItem(key);
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored || '')) return stored;
            const created = create();
            localStorage.setItem(key, created);
            return created;
        } catch (_) {
            return create();
        }
    }

    async function loadTotalVisitors(client, id) {
        const output = document.getElementById('totalVisitors');
        try {
            const recorded = await client.rpc('record_visit', { p_visitor_id: id });
            if (recorded.error) throw recorded.error;
            const total = await client.rpc('get_total_visitors');
            if (total.error) throw total.error;
            output.textContent = String(total.data ?? recorded.data ?? 0);
            setStatus(visitorStatus, `${output.textContent} total visitors. Connecting current visitors.`);
        } catch (error) {
            output.textContent = '--';
            setStatus(visitorStatus, 'Total visitor count is unavailable.', true);
            console.warn('visitor total:', error.message);
        }
    }

    function connectPresence(client, id) {
        const output = document.getElementById('currentVisitors');
        const channel = client.channel('aleaf-live-visitors', { config: { presence: { key: id } } });
        channel.on('presence', { event: 'sync' }, () => {
            const count = Object.keys(channel.presenceState()).length;
            output.textContent = String(count);
            setStatus(visitorStatus, `${document.getElementById('totalVisitors').textContent} total visitors. ${count} here right now.`);
        });
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const result = await channel.track({ online_at: new Date().toISOString() });
                if (result !== 'ok') {
                    output.textContent = '--';
                    setStatus(visitorStatus, 'Current visitor count is unavailable.', true);
                }
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                output.textContent = '--';
                setStatus(visitorStatus, 'Current visitor count is unavailable.', true);
            }
        });
    }

    function initialize() {
        if (!configured) {
            setStatus(guestbookStatus, 'The guestbook is unavailable until the backend is configured.', true);
            setStatus(galleryStatus, 'The gallery is unavailable until the backend is configured.', true);
            setStatus(visitorStatus, 'Visitor statistics are unavailable.', true);
            document.getElementById('totalVisitors').textContent = '--';
            document.getElementById('currentVisitors').textContent = '--';
            disableForms('Messaging is unavailable until the backend is configured.');
            return;
        }

        const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        bindGuestbookDialog(client);
        bindRpcForm(client, {
            formId: 'inboxForm',
            statusId: 'inboxFormStatus',
            rpc: 'submit_inbox_message',
            values: (form) => ({
                p_sender_name: { text: form.elements.sender_name.value, required: true },
                p_reply_contact: { text: form.elements.reply_contact.value, required: false },
                p_body: { text: form.elements.body.value, required: true }
            }),
            loading: 'Sending privately...',
            success: 'Private message delivered. It will not appear publicly.',
            failure: 'Your private message could not be sent. Please try again.'
        });

        const id = visitorId();
        loadTotalVisitors(client, id);
        connectPresence(client, id);
        if (window.ALEAF_CONTENT?.site?.guestbookEnabled !== false) loadGuestbook(client);
        if (window.ALEAF_CONTENT?.site?.galleryEnabled !== false) loadGallery(client);
        window.addEventListener('aleaf:refresh', (event) => {
            if (event.detail === 'guestbook') loadGuestbook(client);
            if (event.detail === 'gallery') loadGallery(client);
            if (event.detail === 'profile') loadTotalVisitors(client, id);
        });
    }

    (window.ALEAF_CONTENT_READY || Promise.resolve()).then(initialize);
})();
