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
        const composeSend = document.getElementById('composeSend');
        if (composeSend) composeSend.disabled = true;
        const composeBody = document.getElementById('composeBody');
        if (composeBody) composeBody.disabled = true;
        setStatus(document.getElementById('composeStatus'), message, true);
    }

    function safePublicUrl(value) {
        try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch (_) {
            return '';
        }
    }

    function safeCaptchaUrl(value) {
        try {
            const url = new URL(value);
            if (url.protocol !== 'https:' || url.port || url.username || url.password) return '';
            // Accept direct CDN images or Edge Function proxy URLs from our project.
            if (url.hostname === 'cdn.donmai.us') return url.href;
            if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/functions/v1/guestbook-captcha')) return url.href;
            return '';
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
            entries.forEach((entry, index) => {
                const article = document.createElement('article');
                article.className = 'guestbook-entry';
                article.dataset.entryIndex = String(entries.length - index).padStart(2, '0');
                const heading = document.createElement('div');
                heading.className = 'guestbook-entry-heading';
                const author = document.createElement('div');
                author.className = 'guestbook-author';
                const authorMark = document.createElement('span');
                authorMark.className = 'guestbook-author-mark';
                authorMark.textContent = (entry.display_name || 'anonymous visitor').trim().charAt(0).toUpperCase() || '?';
                authorMark.setAttribute('aria-hidden', 'true');
                const name = document.createElement('strong');
                name.textContent = entry.display_name || 'anonymous visitor';
                const time = document.createElement('time');
                const dateText = displayDate(entry.created_at);
                time.textContent = dateText;
                if (entry.created_at) time.dateTime = entry.created_at;
                time.hidden = !dateText;
                author.append(authorMark, name);
                heading.append(author, time);
                const body = document.createElement('p');
                body.textContent = entry.body || entry.message || '';
                article.append(heading, body);
                if (typeof entry.owner_reply === 'string' && entry.owner_reply.trim()) {
                    const reply = document.createElement('div');
                    reply.className = 'guestbook-owner-reply';
                    const replyHeading = document.createElement('div');
                    replyHeading.className = 'guestbook-reply-heading';
                    const replyLabel = document.createElement('strong');
                    replyLabel.textContent = 'leaf replied';
                    const replyTime = document.createElement('time');
                    const replyDateText = displayDate(entry.replied_at);
                    replyTime.textContent = replyDateText;
                    if (entry.replied_at) replyTime.dateTime = entry.replied_at;
                    replyTime.hidden = !replyDateText;
                    const replyBody = document.createElement('p');
                    replyBody.textContent = entry.owner_reply.trim();
                    replyHeading.append(replyLabel, replyTime);
                    reply.append(replyHeading, replyBody);
                    article.append(reply);
                }
                root.append(article);
            });
            setStatus(guestbookStatus, entries.length ? `${entries.length} approved ${entries.length === 1 ? 'entry' : 'entries'}.` : 'No approved entries yet. Be the first to leave a note.');
            guestbookStatus.classList.toggle('is-empty', entries.length === 0);
        } catch (error) {
            root.replaceChildren();
            guestbookStatus.classList.remove('is-empty');
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


    function bindGuestbookDialog(client) {
        const dialog = document.getElementById('guestbookDialog');
        const form = document.getElementById('guestbookForm');
        const closeButton = document.getElementById('guestbookClose');
        const cancelButton = document.getElementById('guestbookCancel');
        const refreshButton = document.getElementById('guestbookCaptchaRefresh');
        const puzzleImage = document.getElementById('captchaPuzzleImage');
        const puzzlePiece = document.getElementById('captchaPuzzlePiece');
        const slider = document.getElementById('guestbookCaptchaSlider');
        const captchaStatus = document.getElementById('guestbookCaptchaStatus');
        const formStatus = document.getElementById('guestbookFormStatus');
        const composeStatus = document.getElementById('composeStatus');
        const composeTextarea = document.getElementById('composeBody');
        const submitButton = form.querySelector('button[type="submit"]');
        let challenge = null;
        let challengeRequest = 0;
        let puzzleData = null;

        function positionToToken(pos) {
            const rounded = Math.round(pos);
            const hex = Math.max(0, Math.min(999, rounded)).toString(16).padStart(12, '0');
            return `00000000-0000-4000-8000-${hex}`;
        }

        function updatePuzzlePiece() {
            if (!puzzleData) return;
            const ratio = slider.value / slider.max;
            const x = puzzleData.minX + ratio * (puzzleData.maxX - puzzleData.minX);
            puzzlePiece.style.left = x + 'px';
        }

        async function loadChallenge() {
            const request = ++challengeRequest;
            challenge = null;
            puzzleData = null;
            puzzleImage.replaceChildren();
            puzzlePiece.style.cssText = '';
            slider.value = 0;
            slider.disabled = true;
            submitButton.disabled = true;
            refreshButton.disabled = true;
            setStatus(captchaStatus, 'Loading puzzle...');
            try {
                const { data, error } = await client.functions.invoke('guestbook-captcha');
                if (error) throw error;
                if (request !== challengeRequest || !dialog.open) return;
                if (!data || !data.challenge_id || !data.image_url || typeof data.target_x !== 'number') {
                    throw new Error('Invalid CAPTCHA challenge');
                }
                const imageUrl = safeCaptchaUrl(data.image_url);
                if (!imageUrl) throw new Error('Invalid image URL');

                puzzleData = {
                    displayWidth: data.display_width || 280,
                    pieceSize: data.piece_size || 50,
                    targetX: data.target_x,
                    minX: data.min_x || 0,
                    maxX: data.max_x || 230
                };

                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = 'Slide puzzle';
                img.referrerPolicy = 'no-referrer';
                img.draggable = false;
                puzzleImage.appendChild(img);

                puzzleImage.style.width = puzzleData.displayWidth + 'px';
                puzzlePiece.style.width = puzzleData.pieceSize + 'px';
                puzzlePiece.style.height = puzzleData.pieceSize + 'px';
                puzzlePiece.style.backgroundImage = `url(${imageUrl})`;
                puzzlePiece.style.backgroundSize = `${puzzleData.displayWidth}px auto`;
                puzzlePiece.style.backgroundPosition = `-${puzzleData.targetX}px -${(img.naturalHeight || 150) / 2 - puzzleData.pieceSize / 2}px`;

                img.onload = () => {
                    if (request !== challengeRequest) return;
                    puzzlePiece.style.backgroundSize = `${puzzleData.displayWidth}px auto`;
                    puzzlePiece.style.backgroundPosition = `-${puzzleData.targetX}px -${img.naturalHeight / 2 - puzzleData.pieceSize / 2}px`;
                    puzzlePiece.style.top = (img.offsetHeight / 2 - puzzleData.pieceSize / 2) + 'px';
                };
                puzzlePiece.style.top = '50%';
                puzzlePiece.style.transform = 'translateY(-50%)';
                puzzlePiece.style.left = '0px';

                challenge = {
                    id: data.challenge_id,
                    expiresAt: data.expires_at ? new Date(data.expires_at).valueOf() : null
                };
                slider.disabled = false;
                slider.value = 0;
                setStatus(captchaStatus, 'Slide the piece to match the cutout.');
            } catch (error) {
                if (request !== challengeRequest || !dialog.open) return;
                setStatus(captchaStatus, 'Puzzle could not be loaded. Please try again.', true);
                console.warn('guestbook-captcha:', error.message);
            } finally {
                if (request === challengeRequest) { refreshButton.disabled = false; }
            }
        }

        slider.addEventListener('input', () => { updatePuzzlePiece(); submitButton.disabled = !challenge; });

        dialog.addEventListener('compose-open', () => {
            if (dialog.open) return;
            setStatus(formStatus, '');
            dialog.showModal();
            loadChallenge();
        });
        refreshButton.addEventListener('click', () => { setStatus(formStatus, ''); loadChallenge(); });
        closeButton.addEventListener('click', () => dialog.close());
        cancelButton.addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => {
            challengeRequest += 1;
            challenge = null;
            puzzleData = null;
            puzzleImage.replaceChildren();
            puzzlePiece.style.cssText = '';
            slider.value = 0;
            slider.disabled = true;
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            if (!challenge || (challenge.expiresAt && challenge.expiresAt <= Date.now())) {
                setStatus(formStatus, 'Verification expired. Please try the new puzzle.', true);
                loadChallenge();
                return;
            }
            if (!puzzleData) {
                setStatus(formStatus, 'Please solve the puzzle first.', true);
                return;
            }

            const ratio = slider.value / slider.max;
            const currentX = puzzleData.minX + ratio * (puzzleData.maxX - puzzleData.minX);
            const token = positionToToken(currentX);
            submitButton.disabled = true;
            refreshButton.disabled = true;
            setStatus(formStatus, 'Sending your note...');
            try {
                const { data, error } = await client.rpc('submit_guestbook_entry', {
                    p_display_name: form.elements.display_name.value.trim(),
                    p_message: form.elements.body.value.trim(),
                    p_challenge_id: challenge.id,
                    p_selected_tokens: [token]
                });
                if (error) throw error;
                if (data === null || data === false || data === '' || (typeof data === 'object' && data.success === false)) {
                    throw new Error('Submission was rejected');
                }
                form.reset();
                dialog.close();
                if (composeTextarea) {
                    composeTextarea.value = '';
                    document.getElementById('composeCharCount').textContent = '0 / 1000';
                }
                setStatus(composeStatus, 'Note received. It will appear after approval.');
            } catch (error) {
                setStatus(formStatus, 'Your note could not be sent. Please try the new verification images.', true);
                console.warn('submit_guestbook_entry:', error.message);
                await loadChallenge();
            }
        });
    }

    function bindComposeCard(client) {
        const toggle = document.getElementById('composeModeToggle');
        const hint = document.getElementById('composeHint');
        const textarea = document.getElementById('composeBody');
        const charCount = document.getElementById('composeCharCount');
        const sendBtn = document.getElementById('composeSend');
        const status = document.getElementById('composeStatus');
        const guestbookDialog = document.getElementById('guestbookDialog');
        const privateDialog = document.getElementById('privateDialog');
        const privateBody = document.getElementById('privateBody');
        const guestbookBody = document.getElementById('guestbookBody');

        function isPrivate() { return toggle.checked; }

        function updateMode() {
            const privateMode = isPrivate();
            toggle.setAttribute('aria-checked', String(privateMode));
            const publicLabel = document.querySelector('.compose-toggle-label[data-mode="public"]');
            const privateLabel = document.querySelector('.compose-toggle-label[data-mode="private"]');
            if (publicLabel) publicLabel.style.color = privateMode ? '' : '#ffe5f3';
            if (privateLabel) privateLabel.style.color = privateMode ? '#ffe5f3' : '';
            hint.textContent = privateMode
                ? 'Visible only to Leaf. Fully anonymous, no reply possible.'
                : 'Visible to everyone after approval. Includes a CAPTCHA.';
            textarea.placeholder = privateMode
                ? 'Write something only Leaf will see...'
                : 'Write a note for everyone passing through...';
        }

        toggle.addEventListener('change', updateMode);
        textarea.addEventListener('input', () => {
            charCount.textContent = `${textarea.value.length} / 1000`;
        });

        sendBtn.addEventListener('click', () => {
            const body = textarea.value.trim();
            if (body.length < 2) {
                setStatus(status, 'Please write at least a couple of characters.', true);
                return;
            }
            setStatus(status, '');
            if (isPrivate()) {
                privateBody.value = body;
                privateDialog.showModal();
            } else {
                guestbookBody.value = body;
                guestbookDialog.showModal();
                // Trigger the captcha load via the existing open handler
                const event = new Event('compose-open');
                guestbookDialog.dispatchEvent(event);
            }
        });

        updateMode();
    }

    function bindPrivateDialog(client) {
        const dialog = document.getElementById('privateDialog');
        const form = document.getElementById('privateForm');
        const closeBtn = document.getElementById('privateClose');
        const cancelBtn = document.getElementById('privateCancel');
        const formStatus = document.getElementById('privateFormStatus');
        const composeStatus = document.getElementById('composeStatus');
        const textarea = document.getElementById('composeBody');

        closeBtn.addEventListener('click', () => dialog.close());
        cancelBtn.addEventListener('click', () => dialog.close());

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;

            const body = document.getElementById('privateBody').value.trim();
            if (!body) {
                setStatus(formStatus, 'Please enter a message.', true);
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            setStatus(formStatus, 'Sending anonymously...');

            try {
                const { error } = await client.rpc('submit_inbox_message', {
                    p_body: body
                });
                if (error) throw error;
                form.reset();
                dialog.close();
                textarea.value = '';
                document.getElementById('composeCharCount').textContent = '0 / 1000';
                setStatus(composeStatus, 'Anonymous message delivered. It cannot be replied to or shown publicly.');
            } catch (error) {
                setStatus(formStatus, 'Your message could not be sent. Please try again.', true);
                console.warn('submit_inbox_message:', error.message);
            } finally {
                submitBtn.disabled = false;
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

    async function loadTotalVisitors(client) {
        const output = document.getElementById('totalVisitors');
        try {
            const { data, error } = await client.functions.invoke('visitor-counter');
            if (error) throw error;
            if (!data || !Number.isFinite(Number(data.total))) throw new Error('Invalid visitor total');
            output.textContent = String(data.total);
            setStatus(visitorStatus, `${output.textContent} total visitors. Connecting current visitors.`);
        } catch (error) {
            console.warn('visitor-counter:', error.message);
            try {
                const fallback = await client.rpc('get_total_visitors');
                if (fallback.error) throw fallback.error;
                if (!Number.isFinite(Number(fallback.data))) throw new Error('Invalid visitor total');
                output.textContent = String(fallback.data);
                setStatus(visitorStatus, `${output.textContent} total visitors. Connecting current visitors.`);
            } catch (fallbackError) {
                output.textContent = '--';
                setStatus(visitorStatus, 'Total visitor count is unavailable.', true);
                console.warn('visitor total fallback:', fallbackError.message);
            }
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
        bindComposeCard(client);
        bindPrivateDialog(client);

        const id = visitorId();
        loadTotalVisitors(client);
        connectPresence(client, id);
        if (window.ALEAF_CONTENT?.site?.guestbookEnabled !== false) loadGuestbook(client);
        if (window.ALEAF_CONTENT?.site?.galleryEnabled !== false) loadGallery(client);
        window.addEventListener('aleaf:refresh', (event) => {
            if (event.detail === 'guestbook') loadGuestbook(client);
            if (event.detail === 'gallery') loadGallery(client);
            if (event.detail === 'profile') loadTotalVisitors(client);
        });
    }

    (window.ALEAF_CONTENT_READY || Promise.resolve()).then(initialize);
})();
