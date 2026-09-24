(function () {
    'use strict';

    document.body.classList.remove('embedded');

    const config = window.ALEAF_BACKEND || {};
    const configured = /^https:\/\/.+\.supabase\.co$/.test(config.supabaseUrl || '') && config.supabaseAnonKey && !config.supabaseAnonKey.includes('YOUR_');
    const client = configured ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
    const clone = (value) => JSON.parse(JSON.stringify(value));
    let content = clone(window.ALEAF_DEFAULT_CONTENT);
    let dirty = false;
    let changeVersion = 0;

    const loginView = document.getElementById('loginView');
    const dashboardView = document.getElementById('dashboardView');
    const message = document.getElementById('loginMessage');
    const status = document.getElementById('saveStatus');

    function setDirty(value = true) {
        dirty = value;
        if (value) changeVersion += 1;
        status.classList.toggle('dirty', value);
        status.textContent = value ? 'Unpublished changes.' : 'All changes published.';
    }

    function merge(base, remote) {
        const output = clone(base);
        if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return output;
        Object.entries(remote).forEach(([key, value]) => {
            if (value && typeof value === 'object' && !Array.isArray(value) && output[key] && typeof output[key] === 'object' && !Array.isArray(output[key])) {
                output[key] = { ...output[key], ...value };
            } else if (value !== null && value !== undefined) output[key] = value;
        });
        return output;
    }

    function validateQuizzes(tests) {
        const required = ['political', 'philosophical', 'eeveelution'];
        return required.every((key) => {
            const test = tests[key];
            return test && typeof test.name === 'string' && Array.isArray(test.ideologies) && test.ideologies.length > 0 &&
                Array.isArray(test.questions) && test.questions.length > 0 && test.questions.every((question) =>
                    typeof question.q === 'string' && Array.isArray(question.options) && question.options.length === 4 &&
                    question.options.every((option) => typeof option === 'string') && question.weights &&
                    test.ideologies.every((ideology) => Array.isArray(question.weights[ideology]) &&
                        question.weights[ideology].length === 4 && question.weights[ideology].every(Number.isFinite))
                );
        });
    }

    function validateContent(candidate) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('The root value must be an object.');
        if (!candidate.site || typeof candidate.site !== 'object') throw new Error('The site object is required.');
        const siteStrings = ['title','profileHeading','gamesHeading','quizHeading','quizIntro','guestbookHeading','guestbookIntro','privateMessageHeading','galleryHeading','galleryIntro','profileImage','birthDate','musicUrl'];
        const siteBooleans = ['musicEnabled','gamesEnabled','quizzesEnabled','socialsEnabled','guestbookEnabled','galleryEnabled'];
        if (!siteStrings.every((key) => typeof candidate.site[key] === 'string') || !siteBooleans.every((key) => typeof candidate.site[key] === 'boolean')) throw new Error('General settings are incomplete or have invalid types.');
        if (!Array.isArray(candidate.profile) || !candidate.profile.every((item) => typeof item?.label === 'string' && typeof item?.value === 'string')) throw new Error('Profile must contain label and value strings.');
        if (!candidate.scrapbook || typeof candidate.scrapbook !== 'object' || typeof candidate.scrapbook.enabled !== 'boolean' || !['heading','image','caption','stamp'].every((key) => typeof candidate.scrapbook[key] === 'string')) throw new Error('Scrapbook settings are incomplete or invalid.');
        if (!Array.isArray(candidate.scrapbook.items) || !candidate.scrapbook.items.every((item) => ['icon','label','value'].every((key) => typeof item?.[key] === 'string'))) throw new Error('Every scrapbook item requires icon, label, and value strings.');
        if (!Array.isArray(candidate.games) || !candidate.games.every((item) => ['title','image','url'].every((key) => typeof item?.[key] === 'string'))) throw new Error('Every game requires title, image, and URL strings.');
        if (!Array.isArray(candidate.socials) || !candidate.socials.every((item) => ['id','label','url'].every((key) => typeof item?.[key] === 'string') && typeof item.enabled === 'boolean')) throw new Error('Every social link requires id, label, URL, and enabled fields.');
        if (!candidate.theme || !Object.values(candidate.theme).every((value) => /^#[0-9a-f]{6}$/i.test(value))) throw new Error('Theme values must be six-digit hex colors.');
        if (candidate.quizzes !== null && candidate.quizzes !== undefined && !validateQuizzes(candidate.quizzes)) throw new Error('Custom quizzes must include valid political, philosophical, and eeveelution tests.');
        if (candidate.quizDescriptions !== null && candidate.quizDescriptions !== undefined && (typeof candidate.quizDescriptions !== 'object' || !Object.values(candidate.quizDescriptions).every((value) => typeof value === 'string'))) throw new Error('Quiz descriptions must be an object of strings.');
        return candidate;
    }

    function field(label, value, onInput, type = 'text') {
        const wrapper = document.createElement('label');
        wrapper.textContent = label;
        const input = document.createElement('input');
        input.type = type;
        input.value = value ?? '';
        input.addEventListener('input', () => { onInput(input.type === 'checkbox' ? input.checked : input.value); setDirty(); syncAdvanced(); });
        wrapper.append(input);
        return wrapper;
    }

    function checkbox(label, value, onInput) {
        const wrapper = document.createElement('label');
        wrapper.className = 'checkbox-field';
        const input = document.createElement('input');
        input.type = 'checkbox'; input.checked = Boolean(value);
        input.addEventListener('change', () => { onInput(input.checked); setDirty(); syncAdvanced(); });
        wrapper.append(input, document.createTextNode(label));
        return wrapper;
    }

    function renderSite() {
        const root = document.getElementById('siteFields'); root.replaceChildren();
        const fields = [
            ['Site title','title'],['Profile heading','profileHeading'],['Games heading','gamesHeading'],['Quiz heading','quizHeading'],
            ['Quiz introduction','quizIntro'],['Guestbook heading','guestbookHeading'],['Guestbook introduction','guestbookIntro'],
            ['Private message heading','privateMessageHeading'],['Gallery heading','galleryHeading'],['Gallery introduction','galleryIntro'],
            ['Profile image URL','profileImage'],['Birth date','birthDate','date'],['Music URL','musicUrl']
        ];
        fields.forEach(([label,key,type]) => root.append(field(label, content.site[key], (v) => { content.site[key] = v; }, type)));
        [['Enable music','musicEnabled'],['Show games tab','gamesEnabled'],['Show tests tab','quizzesEnabled'],['Show social tab','socialsEnabled'],['Show guestbook','guestbookEnabled'],['Show gallery','galleryEnabled']].forEach(([label,key]) => root.append(checkbox(label, content.site[key], (v) => { content.site[key] = v; })));
    }

    function removeButton(collection, index, render) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'remove-button'; button.textContent = 'Remove';
        button.addEventListener('click', () => { content[collection].splice(index, 1); render(); setDirty(); syncAdvanced(); });
        return button;
    }

    function renderProfile() {
        const root = document.getElementById('profileEditor'); root.replaceChildren();
        content.profile.forEach((item,index) => {
            const row = document.createElement('div'); row.className = 'repeat-row';
            row.append(field('Label',item.label,(v)=>{item.label=v;}), field('Value',item.value,(v)=>{item.value=v;}), removeButton('profile',index,renderProfile));
            if (item.type === 'age') row.dataset.ageField = 'true';
            root.append(row);
        });
    }

    function renderGames() {
        const root = document.getElementById('gamesEditor'); root.replaceChildren();
        content.games.forEach((item,index) => {
            const row = document.createElement('div'); row.className = 'repeat-row game-row';
            row.append(field('Title',item.title,(v)=>{item.title=v;}), field('Image URL or file',item.image,(v)=>{item.image=v;}), field('Destination URL',item.url,(v)=>{item.url=v;}), removeButton('games',index,renderGames)); root.append(row);
        });
    }

    function renderScrapbook() {
        const fieldsRoot = document.getElementById('scrapbookFields'); fieldsRoot.replaceChildren();
        fieldsRoot.append(
            field('Card heading', content.scrapbook.heading, (v) => { content.scrapbook.heading = v; }),
            field('Polaroid image URL or file', content.scrapbook.image, (v) => { content.scrapbook.image = v; }),
            field('Polaroid caption', content.scrapbook.caption, (v) => { content.scrapbook.caption = v; }),
            field('Footer stamp', content.scrapbook.stamp, (v) => { content.scrapbook.stamp = v; }),
            checkbox('Show scrapbook card', content.scrapbook.enabled, (v) => { content.scrapbook.enabled = v; })
        );
        const root = document.getElementById('scrapbookEditor'); root.replaceChildren();
        content.scrapbook.items.forEach((item,index) => {
            const row = document.createElement('div'); row.className = 'repeat-row scrapbook-row';
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-button'; remove.textContent = 'Remove';
            remove.addEventListener('click', () => { content.scrapbook.items.splice(index, 1); renderScrapbook(); setDirty(); syncAdvanced(); });
            row.append(field('Icon id',item.icon,(v)=>{item.icon=v;}), field('Label',item.label,(v)=>{item.label=v;}), field('Value',item.value,(v)=>{item.value=v;}), remove);
            root.append(row);
        });
    }

    function renderSocials() {
        const root = document.getElementById('socialsEditor'); root.replaceChildren();
        content.socials.forEach((item,index) => {
            const row = document.createElement('div'); row.className = 'repeat-row';
            row.append(field('Icon id',item.id,(v)=>{item.id=v;}), field('Label',item.label,(v)=>{item.label=v;}), field('URL',item.url,(v)=>{item.url=v;}), checkbox('Visible',item.enabled,(v)=>{item.enabled=v;}), removeButton('socials',index,renderSocials)); root.append(row);
        });
    }

    function renderTheme() {
        const root = document.getElementById('themeEditor'); root.replaceChildren();
        Object.entries(content.theme).forEach(([key,value]) => { const item=field(key,value,(v)=>{content.theme[key]=v;},'color'); item.classList.add('color-field'); root.append(item); });
    }

    function syncAdvanced() { document.getElementById('advancedJson').value = JSON.stringify(content, null, 2); }
    function renderAll() { renderSite(); renderProfile(); renderScrapbook(); renderGames(); renderSocials(); renderTheme(); syncAdvanced(); }

    async function loadContent() {
        const { data, error } = await client.from('site_content').select('content').eq('id','main').maybeSingle();
        if (error) throw error;
        content = data?.content ? merge(window.ALEAF_DEFAULT_CONTENT, data.content) : clone(window.ALEAF_DEFAULT_CONTENT);
        renderAll(); setDirty(false);
    }

    async function showDashboard() {
        loginView.hidden = true; dashboardView.hidden = false;
        try { await loadContent(); } catch (error) { status.textContent = `Could not load content: ${error.message}`; status.classList.add('dirty'); }
    }

    async function verifyAdminAndShowDashboard() {
        const { data, error } = await client.rpc('is_current_user_admin');
        if (error) throw error;
        if (data !== true) {
            await client.auth.signOut();
            throw new Error('This account is not authorized to use the dashboard.');
        }
        message.textContent = '';
        await showDashboard();
    }

    document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!client) { message.textContent = 'Backend not configured. Complete SETUP.md first.'; return; }
        message.textContent = 'Signing in...';
        const { error } = await client.auth.signInWithPassword({ email: document.getElementById('email').value, password: document.getElementById('password').value });
        if (error) { message.textContent = error.message; return; }
        message.textContent = 'Verifying administrator access...';
        try { await verifyAdminAndShowDashboard(); }
        catch (verifyError) { message.textContent = `Sign in failed: ${verifyError.message}`; }
    });

    document.getElementById('logoutButton').addEventListener('click', async () => { await client.auth.signOut(); location.reload(); });
    document.getElementById('saveButton').addEventListener('click', async () => {
        try { validateContent(content); } catch (error) { status.textContent = `Cannot publish: ${error.message}`; status.classList.add('dirty'); return; }
        const savedVersion = changeVersion;
        status.textContent = 'Publishing...';
        const { error } = await client.from('site_content').upsert({ id:'main', content, updated_at:new Date().toISOString() });
        if (error) { status.textContent = `Publish failed: ${error.message}`; status.classList.add('dirty'); return; }
        if (changeVersion === savedVersion) setDirty(false);
        else { status.textContent = 'Published, but newer local changes remain.'; status.classList.add('dirty'); }
    });

    document.querySelectorAll('[data-editor-tab]').forEach((button) => {
        button.setAttribute('aria-current', button.classList.contains('active') ? 'page' : 'false');
        button.addEventListener('click', () => {
            document.querySelectorAll('[data-editor-tab]').forEach((item) => {
                const active = item === button;
                item.classList.toggle('active', active);
                item.setAttribute('aria-current', active ? 'page' : 'false');
            });
            document.querySelectorAll('[data-editor-panel]').forEach((panel) => { panel.hidden = panel.dataset.editorPanel !== button.dataset.editorTab; });
            if (button.dataset.editorTab === 'guestbook') loadGuestbook();
            if (button.dataset.editorTab === 'inbox') loadInbox();
            if (button.dataset.editorTab === 'gallery') loadGallery();
            if (button.dataset.editorTab === 'hotbuttons') loadHotbuttons();
        });
    });

    document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => {
        const type = button.dataset.add;
        if (type === 'profile') { content.profile.push({label:'NEW FIELD',value:''}); renderProfile(); }
        if (type === 'scrapbook') { content.scrapbook.items.push({icon:'star',label:'new obsession',value:''}); renderScrapbook(); }
        if (type === 'games') { content.games.push({title:'New game',image:'',url:''}); renderGames(); }
        if (type === 'socials') { content.socials.push({id:'github',label:'New link',url:'',enabled:true}); renderSocials(); }
        setDirty(); syncAdvanced();
    }));

    document.getElementById('applyJson').addEventListener('click', () => {
        try {
            const candidate = validateContent(JSON.parse(document.getElementById('advancedJson').value));
            content = candidate;
            renderAll();
            setDirty();
        }
        catch (error) { status.textContent = `Invalid JSON: ${error.message}`; status.classList.add('dirty'); }
    });
    document.getElementById('downloadJson').addEventListener('click', () => {
        const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([JSON.stringify(content,null,2)],{type:'application/json'})); link.download='aleaf-content.json'; link.click(); URL.revokeObjectURL(link.href);
    });
    document.getElementById('uploadForm').addEventListener('submit', async (event) => {
        event.preventDefault(); const file=document.getElementById('mediaFile').files[0]; if(!file)return;
        const safeName=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-'); const path=`${Date.now()}-${safeName}`;
        status.textContent='Uploading...'; const {error}=await client.storage.from('site-media').upload(path,file,{upsert:false});
        if(error){status.textContent=`Upload failed: ${error.message}`;status.classList.add('dirty');return;}
        const {data}=client.storage.from('site-media').getPublicUrl(path); document.getElementById('uploadedUrl').value=data.publicUrl; status.textContent='Upload complete. Copy the URL into a content field.';
    });

    function setSectionStatus(section, text, isError = false) {
        const output = document.getElementById(`${section}Status`);
        output.textContent = text;
        output.classList.toggle('error', isError);
    }

    function textElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        element.textContent = text ?? '';
        return element;
    }

    function stateBadge(value) {
        const badge = textElement('span', 'state-badge', value);
        badge.dataset.state = String(value || '').toLowerCase();
        return badge;
    }

    function actionButton(label, onClick, danger = false, accessibleLabel = label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset.action = label.toLowerCase().split(/\s+/)[0];
        button.setAttribute('aria-label', accessibleLabel);
        if (danger) button.className = 'danger-action';
        button.addEventListener('click', async () => {
            button.disabled = true;
            try { await onClick(); }
            finally { if (button.isConnected) button.disabled = false; }
        });
        return button;
    }

    function renderEmpty(root, text) {
        root.replaceChildren(textElement('p', 'empty-state', text));
    }

    function formatDate(value) {
        if (!value) return 'Date unavailable';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    }

    function safeHttpUrl(value) {
        try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
        } catch (_) {
            return '';
        }
    }

    async function loadGuestbook() {
        const root = document.getElementById('guestbookList');
        setSectionStatus('guestbook', 'Loading entries...');
        const { data, error } = await client.from('guestbook_entries').select('*').order('created_at', { ascending: false });
        if (error) { renderEmpty(root, 'Guestbook entries could not be loaded.'); setSectionStatus('guestbook', `Load failed: ${error.message}`, true); return; }
        root.replaceChildren();
        if (!data.length) { renderEmpty(root, 'No guestbook entries yet.'); setSectionStatus('guestbook', 'No entries.'); return; }
        data.forEach((entry) => {
            const displayName = entry.display_name || 'Anonymous';
            const card = document.createElement('article'); card.className = 'management-card';
            const header = document.createElement('div'); header.className = 'management-card-header';
            const moderationState = entry.approved ? 'approved' : (entry.moderated_at ? 'rejected' : 'pending');
            header.append(textElement('h3', '', displayName), stateBadge(moderationState));
            const meta = textElement('p', 'management-meta', formatDate(entry.created_at));
            const body = textElement('p', '', entry.message);
            const replyField = document.createElement('label'); replyField.className = 'owner-reply-field';
            const replyTextarea = document.createElement('textarea');
            replyTextarea.rows = 4;
            replyTextarea.maxLength = 2000;
            replyTextarea.value = entry.owner_reply ?? '';
            replyTextarea.setAttribute('aria-describedby', `guestbook-reply-state-${entry.id} guestbook-reply-status-${entry.id}`);
            replyField.append(document.createTextNode(`Owner reply to ${displayName}`), replyTextarea);
            const replyState = textElement('p', 'owner-reply-state', '');
            replyState.id = `guestbook-reply-state-${entry.id}`;
            setGuestbookReplyState(replyState, entry.owner_reply, entry.replied_at);
            const replyStatus = textElement('p', 'card-action-status', '');
            replyStatus.id = `guestbook-reply-status-${entry.id}`;
            replyStatus.setAttribute('role', 'status');
            const actions = document.createElement('div'); actions.className = 'management-actions';
            actions.append(
                actionButton('Save reply', () => updateGuestbookReply(entry, replyTextarea.value, replyTextarea, replyState, replyStatus), false, `Save owner reply to ${displayName}`),
                actionButton('Clear reply', () => updateGuestbookReply(entry, '', replyTextarea, replyState, replyStatus), false, `Clear owner reply to ${displayName}`),
                actionButton('Approve', () => updateGuestbookStatus(entry.id, true), false, `Approve guestbook entry from ${displayName}`),
                actionButton('Reject', () => updateGuestbookStatus(entry.id, false), false, `Reject guestbook entry from ${displayName}`),
                actionButton('Delete', () => deleteGuestbookEntry(entry.id), true, `Delete guestbook entry from ${displayName}`)
            );
            card.append(header, meta, body, replyField, replyState, actions, replyStatus); root.append(card);
        });
        setSectionStatus('guestbook', `${data.length} ${data.length === 1 ? 'entry' : 'entries'} loaded.`);
    }

    function setGuestbookReplyState(element, reply, repliedAt) {
        element.textContent = reply ? `Reply saved${repliedAt ? ` ${formatDate(repliedAt)}` : ''}.` : 'No owner reply.';
        element.classList.toggle('has-reply', Boolean(reply));
    }

    async function updateGuestbookReply(entry, value, textarea, replyState, replyStatus) {
        const ownerReply = value.trim() || null;
        const repliedAt = ownerReply ? new Date().toISOString() : null;
        replyStatus.textContent = ownerReply ? 'Saving reply...' : 'Clearing reply...';
        replyStatus.classList.remove('error');
        const { error } = await client.from('guestbook_entries').update({ owner_reply: ownerReply, replied_at: repliedAt }).eq('id', entry.id);
        if (error) {
            replyStatus.textContent = `Reply update failed: ${error.message}`;
            replyStatus.classList.add('error');
            return;
        }
        entry.owner_reply = ownerReply;
        entry.replied_at = repliedAt;
        textarea.value = ownerReply ?? '';
        setGuestbookReplyState(replyState, ownerReply, repliedAt);
        replyStatus.textContent = ownerReply ? 'Reply saved.' : 'Reply cleared.';
    }

    async function updateGuestbookStatus(id, approved) {
        const nextStatus = approved ? 'approved' : 'rejected';
        setSectionStatus('guestbook', `${approved ? 'Approving' : 'Rejecting'} entry...`);
        const { error } = await client.from('guestbook_entries').update({ approved, moderated_at: new Date().toISOString() }).eq('id', id);
        if (error) { setSectionStatus('guestbook', `Update failed: ${error.message}`, true); return; }
        setSectionStatus('guestbook', `Entry ${nextStatus}.`); await loadGuestbook();
    }

    async function deleteGuestbookEntry(id) {
        if (!window.confirm('Permanently delete this guestbook entry?')) return;
        setSectionStatus('guestbook', 'Deleting entry...');
        const { error } = await client.from('guestbook_entries').delete().eq('id', id);
        if (error) { setSectionStatus('guestbook', `Delete failed: ${error.message}`, true); return; }
        setSectionStatus('guestbook', 'Entry deleted.'); await loadGuestbook();
    }

    async function loadInbox() {
        const root = document.getElementById('inboxList');
        setSectionStatus('inbox', 'Loading messages...');
        const { data, error } = await client.from('inbox_messages').select('id, message, is_read, created_at').order('created_at', { ascending: false });
        if (error) { renderEmpty(root, 'Inbox messages could not be loaded.'); setSectionStatus('inbox', `Load failed: ${error.message}`, true); return; }
        root.replaceChildren();
        if (!data.length) { renderEmpty(root, 'Your inbox is empty.'); setSectionStatus('inbox', 'No messages.'); return; }
        data.forEach((item) => {
            const card = document.createElement('article'); card.className = `management-card${item.is_read ? '' : ' is-unread'}`;
            const header = document.createElement('div'); header.className = 'management-card-header';
            header.append(textElement('h3', '', 'anonymous message'), stateBadge(item.is_read ? 'read' : 'unread'));
            card.append(header, textElement('p', 'management-meta', formatDate(item.created_at)), textElement('p', '', item.message));
            const actions = document.createElement('div'); actions.className = 'management-actions';
            actions.append(
                actionButton(item.is_read ? 'Mark unread' : 'Mark read', () => updateInboxRead(item.id, !item.is_read), false, `Mark anonymous message ${item.is_read ? 'unread' : 'read'}`),
                actionButton('Delete', () => deleteInboxMessage(item.id), true, 'Delete anonymous message')
            );
            card.append(actions); root.append(card);
        });
        setSectionStatus('inbox', `${data.length} ${data.length === 1 ? 'message' : 'messages'} loaded.`);
    }

    async function updateInboxRead(id, isRead) {
        setSectionStatus('inbox', `Marking message ${isRead ? 'read' : 'unread'}...`);
        const { error } = await client.from('inbox_messages').update({ is_read: isRead }).eq('id', id);
        if (error) { setSectionStatus('inbox', `Update failed: ${error.message}`, true); return; }
        await loadInbox();
    }

    async function deleteInboxMessage(id) {
        if (!window.confirm('Permanently delete this private message?')) return;
        setSectionStatus('inbox', 'Deleting message...');
        const { error } = await client.from('inbox_messages').delete().eq('id', id);
        if (error) { setSectionStatus('inbox', `Delete failed: ${error.message}`, true); return; }
        setSectionStatus('inbox', 'Message deleted.'); await loadInbox();
    }

    async function loadGallery() {
        const root = document.getElementById('galleryList');
        setSectionStatus('gallery', 'Loading gallery...');
        const { data, error } = await client.from('gallery_items').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
        if (error) { renderEmpty(root, 'Gallery items could not be loaded.'); setSectionStatus('gallery', `Load failed: ${error.message}`, true); return; }
        root.replaceChildren();
        if (!data.length) { renderEmpty(root, 'No gallery images yet.'); setSectionStatus('gallery', 'No images.'); return; }
        data.forEach((item) => {
            const card = document.createElement('article'); card.className = 'management-card gallery-card';
            const image = document.createElement('img'); image.className = 'gallery-thumbnail'; image.src = item.public_url; image.alt = item.alt_text || ''; image.loading = 'lazy';
            const body = document.createElement('div'); body.className = 'gallery-card-body';
            const header = document.createElement('div'); header.className = 'management-card-header';
            header.append(textElement('h3', '', item.title), stateBadge(item.published ? 'published' : 'draft'));
            body.append(header, textElement('p', 'management-meta', `Sort order ${item.sort_order} / ${formatDate(item.created_at)}`));
            if (item.caption) body.append(textElement('p', '', item.caption));
            body.append(textElement('p', 'management-meta', `Alt: ${item.alt_text || 'Not provided'}`));
            const actions = document.createElement('div'); actions.className = 'management-actions';
            actions.append(
                actionButton(item.published ? 'Unpublish' : 'Publish', () => updateGalleryPublished(item.id, !item.published), false, `${item.published ? 'Unpublish' : 'Publish'} ${item.title}`),
                actionButton('Delete image', () => deleteGalleryItem(item), true, `Delete ${item.title}`)
            );
            body.append(actions); card.append(image, body); root.append(card);
        });
        setSectionStatus('gallery', `${data.length} ${data.length === 1 ? 'image' : 'images'} loaded.`);
    }

    async function updateGalleryPublished(id, published) {
        setSectionStatus('gallery', `${published ? 'Publishing' : 'Unpublishing'} image...`);
        const { error } = await client.from('gallery_items').update({ published }).eq('id', id);
        if (error) { setSectionStatus('gallery', `Update failed: ${error.message}`, true); return; }
        await loadGallery();
    }

    async function deleteGalleryItem(item) {
        if (!window.confirm(`Permanently delete "${item.title || 'this image'}" and its stored file?`)) return;
        setSectionStatus('gallery', 'Deleting stored image...');
        const { error: storageError } = await client.storage.from('gallery-media').remove([item.storage_path]);
        if (storageError) { setSectionStatus('gallery', `Storage delete failed: ${storageError.message}`, true); return; }
        const { error } = await client.from('gallery_items').delete().eq('id', item.id);
        if (error) { setSectionStatus('gallery', `Metadata delete failed: ${error.message}`, true); return; }
        setSectionStatus('gallery', 'Gallery image deleted.'); await loadGallery();
    }

    async function loadHotbuttons() {
        const root = document.getElementById('hotbuttonsList');
        setSectionStatus('hotbuttons', 'Loading button submissions...');
        const { data, error } = await client.from('hotbuttons').select('*').order('created_at', { ascending: false });
        if (error) { renderEmpty(root, 'Button submissions could not be loaded.'); setSectionStatus('hotbuttons', `Load failed: ${error.message}`, true); return; }
        root.replaceChildren();
        if (!data.length) { renderEmpty(root, 'No 88×31 button submissions yet.'); setSectionStatus('hotbuttons', 'No submissions.'); return; }

        data.forEach((item) => {
            const siteUrl = safeHttpUrl(item.site_url);
            const imageUrl = safeHttpUrl(item.image_url);
            const card = document.createElement('article');
            card.className = 'management-card hotbutton-management-card';

            const preview = document.createElement('div');
            preview.className = 'hotbutton-admin-preview';
            if (imageUrl) {
                const image = document.createElement('img');
                image.src = imageUrl;
                image.alt = item.button_name || 'Submitted website button';
                image.referrerPolicy = 'no-referrer';
                const dimensions = textElement('span', 'management-meta', 'Checking dimensions...');
                image.addEventListener('load', () => {
                    dimensions.textContent = `${image.naturalWidth} × ${image.naturalHeight}${image.naturalWidth === 88 && image.naturalHeight === 31 ? ' / exact' : ' / not 88×31'}`;
                    dimensions.classList.toggle('error', image.naturalWidth !== 88 || image.naturalHeight !== 31);
                }, { once: true });
                image.addEventListener('error', () => { dimensions.textContent = 'Image failed to load.'; dimensions.classList.add('error'); }, { once: true });
                preview.append(image, dimensions);
            } else preview.append(textElement('span', 'management-meta error', 'Invalid image URL'));

            const body = document.createElement('div');
            body.className = 'hotbutton-admin-body';
            const header = document.createElement('div');
            header.className = 'management-card-header';
            header.append(textElement('h3', '', item.button_name), stateBadge(item.status));
            body.append(header, textElement('p', 'management-meta', formatDate(item.created_at)));

            if (siteUrl) {
                const destination = document.createElement('a');
                destination.className = 'hotbutton-admin-link';
                destination.href = siteUrl;
                destination.target = '_blank';
                destination.rel = 'noopener noreferrer';
                destination.textContent = siteUrl;
                body.append(destination);
            } else body.append(textElement('p', 'management-meta error', 'Invalid destination URL'));
            if (item.note) body.append(textElement('p', '', item.note));

            const actions = document.createElement('div');
            actions.className = 'management-actions';
            actions.append(
                actionButton('Approve', () => updateHotbuttonStatus(item.id, 'approved'), false, `Approve button for ${item.button_name}`),
                actionButton('Reject', () => updateHotbuttonStatus(item.id, 'rejected'), false, `Reject button for ${item.button_name}`),
                actionButton('Delete', () => deleteHotbutton(item.id, item.button_name), true, `Delete button for ${item.button_name}`)
            );
            body.append(actions);
            card.append(preview, body);
            root.append(card);
        });
        setSectionStatus('hotbuttons', `${data.length} ${data.length === 1 ? 'submission' : 'submissions'} loaded.`);
    }

    async function updateHotbuttonStatus(id, nextStatus) {
        setSectionStatus('hotbuttons', `${nextStatus === 'approved' ? 'Approving' : 'Rejecting'} button...`);
        const { error } = await client.from('hotbuttons').update({ status: nextStatus, moderated_at: new Date().toISOString() }).eq('id', id);
        if (error) { setSectionStatus('hotbuttons', `Update failed: ${error.message}`, true); return; }
        await loadHotbuttons();
    }

    async function deleteHotbutton(id, name) {
        if (!window.confirm(`Permanently delete the button submission for "${name || 'this site'}"?`)) return;
        setSectionStatus('hotbuttons', 'Deleting button...');
        const { error } = await client.from('hotbuttons').delete().eq('id', id);
        if (error) { setSectionStatus('hotbuttons', `Delete failed: ${error.message}`, true); return; }
        setSectionStatus('hotbuttons', 'Button deleted.');
        await loadHotbuttons();
    }

    document.getElementById('refreshGuestbook').addEventListener('click', loadGuestbook);
    document.getElementById('refreshInbox').addEventListener('click', loadInbox);
    document.getElementById('refreshGallery').addEventListener('click', loadGallery);
    document.getElementById('refreshHotbuttons').addEventListener('click', loadHotbuttons);
    document.getElementById('galleryUploadForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const submit = form.querySelector('button[type="submit"]');
        const file = document.getElementById('galleryFile').files[0];
        if (!file) return;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
        if (!allowedTypes.includes(file.type) || file.size > 10 * 1024 * 1024) {
            setSectionStatus('gallery', 'Choose a JPEG, PNG, GIF, WebP, or AVIF image no larger than 10 MB.', true);
            return;
        }
        const extensionMatch = file.name.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
        const path = `${crypto.randomUUID()}${extensionMatch ? `.${extensionMatch[1]}` : ''}`;
        submit.disabled = true; setSectionStatus('gallery', 'Uploading image...');
        const { error: uploadError } = await client.storage.from('gallery-media').upload(path, file, { upsert: false, contentType: file.type });
        if (uploadError) { setSectionStatus('gallery', `Upload failed: ${uploadError.message}`, true); submit.disabled = false; return; }
        const { data: urlData } = client.storage.from('gallery-media').getPublicUrl(path);
        const metadata = {
            title: document.getElementById('galleryTitle').value.trim(),
            alt_text: document.getElementById('galleryAlt').value.trim(),
            caption: document.getElementById('galleryCaption').value.trim() || null,
            public_url: urlData.publicUrl,
            storage_path: path,
            sort_order: Number(document.getElementById('gallerySortOrder').value),
            published: document.getElementById('galleryPublished').checked
        };
        setSectionStatus('gallery', 'Saving image details...');
        const { error } = await client.from('gallery_items').insert(metadata);
        if (error) {
            const { error: cleanupError } = await client.storage.from('gallery-media').remove([path]);
            const cleanupMessage = cleanupError ? ` Cleanup also failed: ${cleanupError.message}` : ' The uploaded file was removed.';
            setSectionStatus('gallery', `Metadata save failed: ${error.message}.${cleanupMessage}`, true);
            submit.disabled = false; return;
        }
        form.reset(); document.getElementById('gallerySortOrder').value = '0'; submit.disabled = false;
        setSectionStatus('gallery', 'Gallery image uploaded.'); await loadGallery();
    });
    window.addEventListener('beforeunload',(event)=>{if(dirty){event.preventDefault();event.returnValue='';}});

    if (!configured) message.textContent = 'Backend not configured. Complete SETUP.md first.';
    else client.auth.getSession().then(async ({data}) => {
        if (!data.session) return;
        message.textContent = 'Verifying administrator access...';
        try { await verifyAdminAndShowDashboard(); }
        catch (error) { message.textContent = `Session verification failed: ${error.message}`; }
    });
})();
