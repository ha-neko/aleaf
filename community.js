(function () {
    'use strict';

    const config = window.ALEAF_BACKEND || {};
    const configured = /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl || '') &&
        config.supabaseAnonKey && !config.supabaseAnonKey.includes('YOUR_') && window.supabase;
    const guestbookStatus = document.getElementById('guestbookListStatus');
    const galleryStatus = document.getElementById('galleryStatus');
    const hotbuttonStatus = document.getElementById('hotbuttonStatus');
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
        const hotbuttonOpen = document.getElementById('hotbuttonOpen');
        if (hotbuttonOpen) hotbuttonOpen.disabled = true;
        setStatus(document.getElementById('composeStatus'), message, true);
    }

    function safePublicUrl(value) {
        try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
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

    function renderPagination(root, totalItems, pageSize, requestedPage, onPageChange) {
        if (!root) return 1;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
        root.replaceChildren();
        root.hidden = totalPages <= 1;
        if (totalPages <= 1) return currentPage;

        const addButton = (label, page, options = {}) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.disabled = options.disabled || false;
            if (options.current) {
                button.classList.add('is-current');
                button.setAttribute('aria-current', 'page');
            }
            button.setAttribute('aria-label', options.ariaLabel || `Page ${page}`);
            button.addEventListener('click', () => onPageChange(page));
            root.appendChild(button);
        };

        addButton('‹', currentPage - 1, { disabled: currentPage === 1, ariaLabel: 'Previous page' });
        const visiblePages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
        let previous = 0;
        [...visiblePages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b).forEach((page) => {
            if (previous && page - previous > 1) {
                const gap = document.createElement('span');
                gap.textContent = '…';
                gap.setAttribute('aria-hidden', 'true');
                root.appendChild(gap);
            }
            addButton(String(page), page, { current: page === currentPage });
            previous = page;
        });
        addButton('›', currentPage + 1, { disabled: currentPage === totalPages, ariaLabel: 'Next page' });
        return currentPage;
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
            const pagination = document.getElementById('guestbookPagination');
            const pageSize = 5;
            const renderPage = (requestedPage) => {
                const page = Math.min(Math.max(1, requestedPage), Math.max(1, Math.ceil(entries.length / pageSize)));
                const start = (page - 1) * pageSize;
                root.replaceChildren();
                entries.slice(start, start + pageSize).forEach((entry, index) => {
                    const article = document.createElement('article');
                    article.className = 'guestbook-entry';
                    article.dataset.entryIndex = String(entries.length - (start + index)).padStart(2, '0');
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
                renderPagination(pagination, entries.length, pageSize, page, renderPage);
                if (entries.length) setStatus(guestbookStatus, `Showing ${start + 1}–${Math.min(start + pageSize, entries.length)} of ${entries.length} approved entries.`);
            };
            renderPage(1);
            if (!entries.length) setStatus(guestbookStatus, 'No approved entries yet. Be the first to leave a note.');
            guestbookStatus.classList.toggle('is-empty', entries.length === 0);
        } catch (error) {
            root.replaceChildren();
            document.getElementById('guestbookPagination').replaceChildren();
            guestbookStatus.classList.remove('is-empty');
            setStatus(guestbookStatus, 'The guestbook could not be loaded right now.', true);
            console.warn('guestbook:', error.message);
        }
    }

    async function loadGallery(client) {
        const root = document.getElementById('galleryItems');
        const count = document.getElementById('galleryCount');
        try {
            const { data, error } = await client.from('gallery_items').select('*').eq('published', true).order('sort_order', { ascending: true }).order('created_at', { ascending: false });
            if (error) throw error;
            const items = (Array.isArray(data) ? data : []).filter(isPublished).filter((item) => safePublicUrl(item.public_url));
            const pagination = document.getElementById('galleryPagination');
            const pageSize = 7;
            const renderPage = (requestedPage) => {
                const page = Math.min(Math.max(1, requestedPage), Math.max(1, Math.ceil(items.length / pageSize)));
                const start = (page - 1) * pageSize;
                const visibleItems = items.slice(start, start + pageSize);
                root.replaceChildren();
                root.classList.toggle('is-single', visibleItems.length === 1);
                root.classList.toggle('is-pair', visibleItems.length === 2);
                visibleItems.forEach((item, index) => {
                    const figure = document.createElement('figure');
                    figure.className = `gallery-item${index === 0 && visibleItems.length >= 3 ? ' gallery-item-featured' : ''}`;
                    figure.dataset.archiveIndex = String(start + index + 1).padStart(2, '0');
                    figure.tabIndex = 0;
                    figure.setAttribute('role', 'button');
                    figure.setAttribute('aria-label', `Open gallery post: ${item.title || `archive item ${start + index + 1}`}`);
                    const openPost = () => {
                        document.getElementById('galleryDialog').dispatchEvent(new CustomEvent('gallery-open', {
                            detail: { items, index: start + index }
                        }));
                    };
                    figure.addEventListener('click', openPost);
                    figure.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openPost();
                        }
                    });
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
                    } else figure.append(image);
                    root.append(figure);
                });
                renderPagination(pagination, items.length, pageSize, page, renderPage);
                if (items.length) setStatus(galleryStatus, `Showing ${start + 1}–${Math.min(start + pageSize, items.length)} of ${items.length} published pieces.`);
            };
            renderPage(1);
            if (count) count.textContent = `${String(items.length).padStart(2, '0')} ${items.length === 1 ? 'piece' : 'pieces'}`;
            if (!items.length) setStatus(galleryStatus, 'The gallery is quiet for now. Published pieces will appear here.');
            galleryStatus.classList.toggle('is-empty', items.length === 0);
        } catch (error) {
            root.replaceChildren();
            root.classList.remove('is-single', 'is-pair');
            document.getElementById('galleryPagination').replaceChildren();
            if (count) count.textContent = '-- pieces';
            setStatus(galleryStatus, 'The gallery could not be loaded right now.', true);
            console.warn('gallery:', error.message);
        }
    }

    function bindGalleryDialog() {
        const dialog = document.getElementById('galleryDialog');
        const closeButton = document.getElementById('galleryDialogClose');
        const image = document.getElementById('galleryDialogImage');
        const indexLabel = document.getElementById('galleryDialogIndex');
        const title = document.getElementById('galleryDialogTitle');
        const caption = document.getElementById('galleryDialogCaption');
        const original = document.getElementById('galleryDialogOriginal');
        const previous = document.getElementById('galleryDialogPrevious');
        const next = document.getElementById('galleryDialogNext');
        let posts = [];
        let currentIndex = 0;

        function renderPost() {
            const item = posts[currentIndex];
            if (!item) return;
            const imageUrl = safePublicUrl(item.public_url);
            image.src = imageUrl;
            image.alt = item.alt_text || item.alt || item.title || 'Published gallery item';
            indexLabel.textContent = `archive ${String(currentIndex + 1).padStart(2, '0')} / ${String(posts.length).padStart(2, '0')}`;
            title.textContent = item.title || 'untitled fragment';
            const captionText = item.caption || item.description || '';
            caption.textContent = captionText;
            caption.hidden = !captionText;
            original.href = imageUrl;
            previous.disabled = currentIndex === 0;
            next.disabled = currentIndex === posts.length - 1;
        }

        dialog.addEventListener('gallery-open', (event) => {
            posts = Array.isArray(event.detail?.items) ? event.detail.items : [];
            currentIndex = Math.min(Math.max(0, Number(event.detail?.index) || 0), Math.max(0, posts.length - 1));
            if (!posts.length) return;
            renderPost();
            if (!dialog.open) dialog.showModal();
        });
        closeButton.addEventListener('click', () => dialog.close());
        previous.addEventListener('click', () => {
            if (currentIndex <= 0) return;
            currentIndex -= 1;
            renderPost();
        });
        next.addEventListener('click', () => {
            if (currentIndex >= posts.length - 1) return;
            currentIndex += 1;
            renderPost();
        });
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.close();
        });
        dialog.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft' && !previous.disabled) previous.click();
            if (event.key === 'ArrowRight' && !next.disabled) next.click();
        });
        dialog.addEventListener('close', () => {
            image.removeAttribute('src');
            posts = [];
        });
    }

    async function loadHotbuttons(client) {
        const root = document.getElementById('hotbuttonWall');
        try {
            const { data, error } = await client.from('hotbuttons').select('id, button_name, site_url, image_url, note, created_at').eq('status', 'approved').order('created_at', { ascending: true });
            if (error) throw error;
            const buttons = (Array.isArray(data) ? data : []).filter((item) => safePublicUrl(item.site_url) && safePublicUrl(item.image_url));
            const pagination = document.getElementById('hotbuttonPagination');
            const pageSize = 12;
            const renderPage = (requestedPage) => {
                const page = Math.min(Math.max(1, requestedPage), Math.max(1, Math.ceil(buttons.length / pageSize)));
                const start = (page - 1) * pageSize;
                root.replaceChildren();
                buttons.slice(start, start + pageSize).forEach((item, index) => {
                    const link = document.createElement('a');
                    link.className = 'hotbutton-item';
                    link.href = safePublicUrl(item.site_url);
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.title = item.note ? `${String(start + index + 1).padStart(2, '0')} / ${item.button_name}: ${item.note}` : `${String(start + index + 1).padStart(2, '0')} / ${item.button_name}`;

                    const image = document.createElement('img');
                    image.src = safePublicUrl(item.image_url);
                    image.width = 88;
                    image.height = 31;
                    image.alt = `${String(start + index + 1).padStart(2, '0')}. ${item.button_name}`;
                    image.loading = 'lazy';
                    image.referrerPolicy = 'no-referrer';
                    link.appendChild(image);
                    root.appendChild(link);
                });
                renderPagination(pagination, buttons.length, pageSize, page, renderPage);
                if (buttons.length) setStatus(hotbuttonStatus, `Showing ${start + 1}–${Math.min(start + pageSize, buttons.length)} of ${buttons.length} approved buttons.`);
            };
            renderPage(1);
            if (!buttons.length) setStatus(hotbuttonStatus, 'No approved buttons yet. The first tiny portal could be yours.');
            hotbuttonStatus.classList.toggle('is-empty', buttons.length === 0);
        } catch (error) {
            root.replaceChildren();
            document.getElementById('hotbuttonPagination').replaceChildren();
            setStatus(hotbuttonStatus, 'The button wall could not be loaded right now.', true);
            console.warn('hotbuttons:', error.message);
        }
    }


    function bindGuestbookDialog(client) {
        const dialog = document.getElementById('guestbookDialog');
        const form = document.getElementById('guestbookForm');
        const closeButton = document.getElementById('guestbookClose');
        const cancelButton = document.getElementById('guestbookCancel');
        const refreshButton = document.getElementById('guestbookCaptchaRefresh');
        const puzzleImage = document.getElementById('captchaPuzzleImage');
        const piecesRoot = document.getElementById('captchaPuzzlePieces');
        const captchaStatus = document.getElementById('guestbookCaptchaStatus');
        const formStatus = document.getElementById('guestbookFormStatus');
        const composeStatus = document.getElementById('composeStatus');
        const composeTextarea = document.getElementById('composeBody');
        const submitButton = form.querySelector('button[type="submit"]');
        let challenge = null;
        let challengeRequest = 0;
        let puzzleData = null;
        let selectedTokens = null;
        let placedPiece = null;
        let dragState = null;

        function sortPieces() {
            [...piecesRoot.querySelectorAll('.captcha-puzzle-piece')]
                .sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order))
                .forEach((piece) => piecesRoot.appendChild(piece));
        }

        function resetPieceStyle(piece) {
            piece.classList.remove('is-dragging', 'is-placed');
            ['position', 'left', 'top', 'width', 'height', 'zIndex'].forEach((property) => {
                piece.style[property] = '';
            });
        }

        function returnPieceToTray(piece) {
            if (!piece) return;
            resetPieceStyle(piece);
            piecesRoot.appendChild(piece);
            sortPieces();
            if (placedPiece === piece) {
                placedPiece = null;
                selectedTokens = null;
                submitButton.disabled = true;
            }
        }

        function placePiece(piece) {
            if (!puzzleData || !puzzleData.slot) return;
            if (placedPiece && placedPiece !== piece) returnPieceToTray(placedPiece);

            const { slot, displayWidth, displayHeight, pieceSize, targetX, targetY } = puzzleData;
            resetPieceStyle(piece);
            piece.classList.add('is-placed');
            piece.style.position = 'absolute';
            piece.style.left = `${targetX / displayWidth * 100}%`;
            piece.style.top = `${targetY / displayHeight * 100}%`;
            piece.style.width = `${pieceSize / displayWidth * 100}%`;
            piece.style.height = `${pieceSize / displayHeight * 100}%`;
            puzzleImage.appendChild(piece);
            slot.classList.add('has-piece');
            placedPiece = piece;
            selectedTokens = puzzleData.tokens.get(piece.dataset.pieceId) || null;
            submitButton.disabled = !selectedTokens;
            setStatus(captchaStatus, 'Piece placed. If the picture matches, send your note.');
        }

        function finishDrag(event, cancelled = false) {
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            const { piece, placeholder } = dragState;
            const slotRect = puzzleData && puzzleData.slot ? puzzleData.slot.getBoundingClientRect() : null;
            const pieceRect = piece.getBoundingClientRect();
            const centerX = pieceRect.left + pieceRect.width / 2;
            const centerY = pieceRect.top + pieceRect.height / 2;
            const droppedInSlot = !cancelled && slotRect &&
                centerX >= slotRect.left && centerX <= slotRect.right &&
                centerY >= slotRect.top && centerY <= slotRect.bottom;

            try { piece.releasePointerCapture(event.pointerId); } catch { /* already released */ }
            placeholder?.remove();
            dragState = null;
            if (droppedInSlot) placePiece(piece);
            else {
                returnPieceToTray(piece);
                if (puzzleData && puzzleData.slot) puzzleData.slot.classList.remove('has-piece');
                setStatus(captchaStatus, 'Drop one piece inside the missing square.');
            }
        }

        function startDrag(event) {
            if (!puzzleData || !challenge || (event.pointerType === 'mouse' && event.button !== 0)) return;
            event.preventDefault();
            const piece = event.currentTarget;
            const rect = piece.getBoundingClientRect();
            const placeholder = document.createElement('span');
            placeholder.className = 'captcha-piece-placeholder';
            placeholder.style.width = `${rect.width}px`;
            placeholder.style.height = `${rect.height}px`;

            if (piece.parentElement === piecesRoot) piece.replaceWith(placeholder);
            else if (placedPiece === piece) {
                placedPiece = null;
                selectedTokens = null;
                submitButton.disabled = true;
                puzzleData.slot.classList.remove('has-piece');
            }

            document.body.appendChild(piece);
            piece.classList.remove('is-placed');
            piece.classList.add('is-dragging');
            piece.style.position = 'fixed';
            piece.style.left = `${rect.left}px`;
            piece.style.top = `${rect.top}px`;
            piece.style.width = `${rect.width}px`;
            piece.style.height = `${rect.height}px`;
            piece.style.zIndex = '9999';
            dragState = {
                piece,
                placeholder,
                pointerId: event.pointerId,
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top
            };
            piece.setPointerCapture(event.pointerId);
        }

        function moveDrag(event) {
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            event.preventDefault();
            dragState.piece.style.left = `${event.clientX - dragState.offsetX}px`;
            dragState.piece.style.top = `${event.clientY - dragState.offsetY}px`;
            const slotRect = puzzleData.slot.getBoundingClientRect();
            const overSlot = event.clientX >= slotRect.left && event.clientX <= slotRect.right &&
                event.clientY >= slotRect.top && event.clientY <= slotRect.bottom;
            puzzleData.slot.classList.toggle('is-ready', overSlot);
        }

        function makePiece(pieceData, index, imageUrl, displayWidth, displayHeight, pieceSize) {
            const piece = document.createElement('button');
            piece.type = 'button';
            piece.className = 'captcha-puzzle-piece';
            piece.dataset.pieceId = pieceData.id;
            piece.dataset.order = String(index);
            piece.setAttribute('aria-label', `Puzzle piece ${index + 1}`);

            const crop = document.createElement('img');
            crop.src = imageUrl;
            crop.alt = '';
            crop.draggable = false;
            crop.style.width = `${displayWidth / pieceSize * 100}%`;
            crop.style.height = `${displayHeight / pieceSize * 100}%`;
            crop.style.left = `${-pieceData.source_x / pieceSize * 100}%`;
            crop.style.top = `${-pieceData.source_y / pieceSize * 100}%`;
            piece.appendChild(crop);

            piece.addEventListener('pointerdown', startDrag);
            piece.addEventListener('pointermove', moveDrag);
            piece.addEventListener('pointerup', (event) => {
                puzzleData?.slot?.classList.remove('is-ready');
                finishDrag(event);
            });
            piece.addEventListener('pointercancel', (event) => {
                puzzleData?.slot?.classList.remove('is-ready');
                finishDrag(event, true);
            });
            return piece;
        }

        function clearPuzzle() {
            if (dragState && dragState.piece.isConnected) dragState.piece.remove();
            dragState?.placeholder?.remove();
            dragState = null;
            placedPiece = null;
            selectedTokens = null;
            puzzleData = null;
            puzzleImage.replaceChildren();
            piecesRoot.replaceChildren();
        }

        async function loadChallenge() {
            const request = ++challengeRequest;
            challenge = null;
            clearPuzzle();
            submitButton.disabled = true;
            refreshButton.disabled = true;
            setStatus(captchaStatus, 'Loading puzzle...');
            try {
                const { data, error } = await client.functions.invoke('guestbook-captcha');
                if (error) throw error;
                if (request !== challengeRequest || !dialog.open) return;
                if (!data || !data.challenge_id || !data.image_url ||
                    typeof data.target_x !== 'number' || typeof data.target_y !== 'number' ||
                    !Array.isArray(data.pieces) || data.pieces.length !== 3) {
                    throw new Error('Invalid CAPTCHA challenge: ' + JSON.stringify(data));
                }

                const dw = data.display_width || 300;
                const dh = data.display_height || 300;
                const ps = data.piece_size || 68;
                const tokens = new Map();
                data.pieces.forEach((piece) => {
                    if (!piece || typeof piece.id !== 'string' ||
                        typeof piece.source_x !== 'number' || typeof piece.source_y !== 'number' ||
                        !Array.isArray(piece.tokens) || piece.tokens.length !== 3) {
                        throw new Error('Invalid CAPTCHA piece');
                    }
                    tokens.set(piece.id, piece.tokens);
                });

                puzzleData = {
                    displayWidth: dw,
                    displayHeight: dh,
                    pieceSize: ps,
                    targetX: data.target_x,
                    targetY: data.target_y,
                    imageUrl: data.image_url,
                    tokens,
                    slot: null
                };

                const img = document.createElement('img');
                img.src = data.image_url;
                img.alt = 'Square Mizuki puzzle from Danbooru';
                img.referrerPolicy = 'no-referrer';
                img.draggable = false;
                puzzleImage.appendChild(img);

                const slot = document.createElement('div');
                slot.className = 'captcha-puzzle-slot';
                slot.style.left = `${data.target_x / dw * 100}%`;
                slot.style.top = `${data.target_y / dh * 100}%`;
                slot.style.width = `${ps / dw * 100}%`;
                slot.style.height = `${ps / dh * 100}%`;
                puzzleImage.appendChild(slot);
                puzzleData.slot = slot;

                data.pieces.forEach((piece, index) => {
                    piecesRoot.appendChild(makePiece(piece, index, data.image_url, dw, dh, ps));
                });

                challenge = {
                    id: data.challenge_id,
                    expiresAt: data.expires_at ? new Date(data.expires_at).valueOf() : null
                };
                submitButton.disabled = true;
                setStatus(captchaStatus, 'Choose the crop that completes the image and drag it into the square.');
            } catch (error) {
                if (request !== challengeRequest || !dialog.open) return;
                setStatus(captchaStatus, 'Puzzle could not be loaded. Please try again.', true);
                console.warn('guestbook-captcha:', error.message);
            } finally {
                if (request === challengeRequest) refreshButton.disabled = false;
            }
        }

        dialog.addEventListener('compose-open', () => {
            setStatus(formStatus, '');
            if (!dialog.open) dialog.showModal();
            loadChallenge();
        });
        refreshButton.addEventListener('click', () => { setStatus(formStatus, ''); loadChallenge(); });
        closeButton.addEventListener('click', () => dialog.close());
        cancelButton.addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => {
            challengeRequest += 1;
            challenge = null;
            clearPuzzle();
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            if (!challenge || (challenge.expiresAt && challenge.expiresAt <= Date.now())) {
                setStatus(formStatus, 'Verification expired. Please try the new puzzle.', true);
                loadChallenge();
                return;
            }
            if (!puzzleData || !selectedTokens) {
                setStatus(formStatus, 'Drag one puzzle piece into the missing square first.', true);
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
                if (composeTextarea) {
                    composeTextarea.value = '';
                    document.getElementById('composeCharCount').textContent = '0 / 1000';
                }
                setStatus(composeStatus, 'Note received. It will appear after approval.');
            } catch (error) {
                setStatus(formStatus, 'That piece did not complete the image. Please try the new puzzle.', true);
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

    function bindHotbuttonDialog(client) {
        const dialog = document.getElementById('hotbuttonDialog');
        const form = document.getElementById('hotbuttonForm');
        const openButton = document.getElementById('hotbuttonOpen');
        const closeButton = document.getElementById('hotbuttonClose');
        const cancelButton = document.getElementById('hotbuttonCancel');
        const imageInput = document.getElementById('hotbuttonImageUrl');
        const preview = document.getElementById('hotbuttonPreview');
        const dimensions = document.getElementById('hotbuttonDimensions');
        const formStatus = document.getElementById('hotbuttonFormStatus');
        let previewTimer = 0;
        let previewRequest = 0;

        function inspectImage(url) {
            return new Promise((resolve, reject) => {
                const image = new Image();
                const timeout = window.setTimeout(() => reject(new Error('Image check timed out.')), 10000);
                image.onload = () => {
                    window.clearTimeout(timeout);
                    resolve({ width: image.naturalWidth, height: image.naturalHeight });
                };
                image.onerror = () => {
                    window.clearTimeout(timeout);
                    reject(new Error('Image could not be loaded.'));
                };
                image.referrerPolicy = 'no-referrer';
                image.src = url;
            });
        }

        async function updatePreview() {
            const request = ++previewRequest;
            const url = safePublicUrl(imageInput.value.trim());
            preview.hidden = true;
            preview.removeAttribute('src');
            if (!url) {
                dimensions.textContent = imageInput.value.trim() ? 'enter a valid HTTP or HTTPS image URL' : 'waiting for an image URL';
                dimensions.classList.toggle('is-error', Boolean(imageInput.value.trim()));
                return false;
            }
            dimensions.textContent = 'checking image dimensions...';
            dimensions.classList.remove('is-error');
            try {
                const size = await inspectImage(url);
                if (request !== previewRequest) return false;
                preview.src = url;
                preview.alt = `88 by 31 preview for ${document.getElementById('hotbuttonName').value.trim() || 'submitted site'}`;
                preview.hidden = false;
                const valid = size.width === 88 && size.height === 31;
                dimensions.textContent = valid ? '88 × 31 — ready' : `${size.width} × ${size.height} — image must be exactly 88 × 31`;
                dimensions.classList.toggle('is-error', !valid);
                return valid;
            } catch (error) {
                if (request !== previewRequest) return false;
                dimensions.textContent = error.message;
                dimensions.classList.add('is-error');
                return false;
            }
        }

        openButton.addEventListener('click', () => {
            setStatus(formStatus, '');
            if (!dialog.open) dialog.showModal();
        });
        closeButton.addEventListener('click', () => dialog.close());
        cancelButton.addEventListener('click', () => dialog.close());
        imageInput.addEventListener('input', () => {
            window.clearTimeout(previewTimer);
            previewTimer = window.setTimeout(updatePreview, 450);
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;

            const siteUrl = safePublicUrl(form.elements.site_url.value.trim());
            const imageUrl = safePublicUrl(form.elements.image_url.value.trim());
            if (!siteUrl || !imageUrl) {
                setStatus(formStatus, 'Use valid HTTP or HTTPS URLs without embedded credentials.', true);
                return;
            }

            setStatus(formStatus, 'Checking the 88 × 31 image...');
            if (!await updatePreview()) {
                setStatus(formStatus, 'The button image must load successfully at exactly 88 × 31 pixels.', true);
                return;
            }

            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            setStatus(formStatus, 'Sending button for approval...');
            try {
                const { data, error } = await client.rpc('submit_hotbutton', {
                    p_button_name: form.elements.button_name.value.trim(),
                    p_site_url: siteUrl,
                    p_image_url: imageUrl,
                    p_note: form.elements.note.value.trim() || null
                });
                if (error) throw error;
                if (!data) throw new Error('Submission was rejected.');
                form.reset();
                preview.hidden = true;
                preview.removeAttribute('src');
                dimensions.textContent = 'waiting for an image URL';
                dimensions.classList.remove('is-error');
                dialog.close();
                setStatus(hotbuttonStatus, 'Button received. It will join the wall if Leaf approves it.');
            } catch (error) {
                setStatus(formStatus, 'Your button could not be submitted. Please check the URLs and try again.', true);
                console.warn('submit_hotbutton:', error.message);
            } finally {
                submitButton.disabled = false;
            }
        });
    }

    function bindSiteButtonCopy() {
        const button = document.getElementById('copySiteButton');
        const code = document.getElementById('siteButtonCode');
        if (!button || !code) return;
        button.addEventListener('click', async () => {
            const value = code.textContent.trim();
            try {
                if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
                else {
                    const textarea = document.createElement('textarea');
                    textarea.value = value;
                    textarea.setAttribute('readonly', '');
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    if (!document.execCommand('copy')) throw new Error('Copy command failed.');
                    textarea.remove();
                }
                const label = button.querySelector('span');
                label.textContent = 'copied';
                button.classList.add('is-copied');
                button.setAttribute('aria-label', 'A Leaf button HTML copied');
                window.setTimeout(() => {
                    label.textContent = 'copy';
                    button.classList.remove('is-copied');
                    button.setAttribute('aria-label', 'Copy A Leaf button HTML');
                }, 1600);
            } catch (error) {
                console.warn('copy site button:', error.message);
                code.focus?.();
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
        bindSiteButtonCopy();
        bindGalleryDialog();
        if (!configured) {
            setStatus(guestbookStatus, 'The guestbook is unavailable until the backend is configured.', true);
            setStatus(galleryStatus, 'The gallery is unavailable until the backend is configured.', true);
            setStatus(hotbuttonStatus, 'The button wall is unavailable until the backend is configured.', true);
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
        bindHotbuttonDialog(client);

        const id = visitorId();
        loadTotalVisitors(client);
        connectPresence(client, id);
        if (window.ALEAF_CONTENT?.site?.guestbookEnabled !== false) {
            loadGuestbook(client);
            loadHotbuttons(client);
        }
        if (window.ALEAF_CONTENT?.site?.galleryEnabled !== false) loadGallery(client);
        window.addEventListener('aleaf:refresh', (event) => {
            if (event.detail === 'guestbook') {
                loadGuestbook(client);
                loadHotbuttons(client);
            }
            if (event.detail === 'gallery') loadGallery(client);
            if (event.detail === 'profile') loadTotalVisitors(client);
        });
    }

    (window.ALEAF_CONTENT_READY || Promise.resolve()).then(initialize);
})();
