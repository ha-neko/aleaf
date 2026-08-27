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
    const emojiPattern = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

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
        const siteStrings = ['title','profileHeading','gamesHeading','quizHeading','quizIntro','profileImage','birthDate','musicUrl'];
        const siteBooleans = ['musicEnabled','gamesEnabled','quizzesEnabled','socialsEnabled'];
        if (!siteStrings.every((key) => typeof candidate.site[key] === 'string') || !siteBooleans.every((key) => typeof candidate.site[key] === 'boolean')) throw new Error('General settings are incomplete or have invalid types.');
        if (!Array.isArray(candidate.profile) || !candidate.profile.every((item) => typeof item?.label === 'string' && typeof item?.value === 'string')) throw new Error('Profile must contain label and value strings.');
        if (!Array.isArray(candidate.games) || !candidate.games.every((item) => ['title','image','url'].every((key) => typeof item?.[key] === 'string'))) throw new Error('Every game requires title, image, and URL strings.');
        if (!Array.isArray(candidate.socials) || !candidate.socials.every((item) => ['id','label','url'].every((key) => typeof item?.[key] === 'string') && typeof item.enabled === 'boolean')) throw new Error('Every social link requires id, label, URL, and enabled fields.');
        if (!candidate.theme || !Object.values(candidate.theme).every((value) => /^#[0-9a-f]{6}$/i.test(value))) throw new Error('Theme values must be six-digit hex colors.');
        if (candidate.quizzes !== null && candidate.quizzes !== undefined && !validateQuizzes(candidate.quizzes)) throw new Error('Custom quizzes must include valid political, philosophical, and eeveelution tests.');
        if (candidate.quizDescriptions !== null && candidate.quizDescriptions !== undefined && (typeof candidate.quizDescriptions !== 'object' || !Object.values(candidate.quizDescriptions).every((value) => typeof value === 'string'))) throw new Error('Quiz descriptions must be an object of strings.');
        if (emojiPattern.test(JSON.stringify(candidate))) throw new Error('Emoji are disabled for this site. Use text or an SVG icon instead.');
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
            ['Quiz introduction','quizIntro'],['Profile image URL','profileImage'],['Birth date','birthDate','date'],['Music URL','musicUrl']
        ];
        fields.forEach(([label,key,type]) => root.append(field(label, content.site[key], (v) => { content.site[key] = v; }, type)));
        [['Enable music','musicEnabled'],['Show games tab','gamesEnabled'],['Show tests tab','quizzesEnabled'],['Show social tab','socialsEnabled']].forEach(([label,key]) => root.append(checkbox(label, content.site[key], (v) => { content.site[key] = v; })));
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
    function renderAll() { renderSite(); renderProfile(); renderGames(); renderSocials(); renderTheme(); syncAdvanced(); }

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

    document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!client) { message.textContent = 'Backend not configured. Complete SETUP.md first.'; return; }
        message.textContent = 'Signing in...';
        const { error } = await client.auth.signInWithPassword({ email: document.getElementById('email').value, password: document.getElementById('password').value });
        if (error) { message.textContent = error.message; return; }
        message.textContent = ''; await showDashboard();
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

    document.querySelectorAll('[data-editor-tab]').forEach((button) => button.addEventListener('click', () => {
        document.querySelectorAll('[data-editor-tab]').forEach((item) => item.classList.toggle('active', item === button));
        document.querySelectorAll('[data-editor-panel]').forEach((panel) => { panel.hidden = panel.dataset.editorPanel !== button.dataset.editorTab; });
    }));

    document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => {
        const type = button.dataset.add;
        if (type === 'profile') { content.profile.push({label:'NEW FIELD',value:''}); renderProfile(); }
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
    window.addEventListener('beforeunload',(event)=>{if(dirty){event.preventDefault();event.returnValue='';}});

    if (!configured) message.textContent = 'Backend not configured. Complete SETUP.md first.';
    else client.auth.getSession().then(({data}) => { if (data.session) showDashboard(); });
})();
