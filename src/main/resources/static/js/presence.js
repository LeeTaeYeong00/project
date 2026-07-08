const colorPalette = ['#2383e2', '#e2618b', '#2eb872', '#e2a53a', '#8a63d2', '#e0555c'];

function colorForUserId(userId) {
    return colorPalette[Math.abs(Number(userId)) % colorPalette.length];
}

export function renderPresence(users) {
    renderTopPanel(users);
    renderDocViewers(users);
}

function renderTopPanel(users) {
    const list = document.getElementById('presence-list');
    if (!list) return;

    const uniqueByUser = new Map();
    users.forEach(u => { if (!uniqueByUser.has(u.userId)) uniqueByUser.set(u.userId, u); });

    list.innerHTML = Array.from(uniqueByUser.values()).map(u => {
        const initial = (u.name || '?').charAt(0);
        const isVisitor = u.role === 'VISITOR';
        const color = isVisitor ? '#b7b7b3' : colorForUserId(u.userId);
        return `
            <div class="presence-avatar ${isVisitor ? 'visitor' : ''}" style="background-color:${color}">
                ${initial}
                <span class="tooltip">${u.name}${isVisitor ? ' (읽기 전용)' : ''}</span>
            </div>`;
    }).join('');
}

// 👇 새로 추가된 부분: 문서 ID별로 그룹핑해서 사이드바에 표시
function renderDocViewers(users) {
    const byDoc = {};
    users.forEach(u => {
        if (!u.documentId) return;
        if (!byDoc[u.documentId]) byDoc[u.documentId] = [];
        if (!byDoc[u.documentId].some(x => x.userId === u.userId)) byDoc[u.documentId].push(u);
    });

    document.querySelectorAll('.doc-viewers').forEach(container => {
        const docId = container.getAttribute('data-doc-id');
        const viewers = byDoc[docId] || [];

        container.innerHTML = viewers.map(u => {
            const initial = (u.name || '?').charAt(0);
            const isVisitor = u.role === 'VISITOR';
            const color = isVisitor ? '#b7b7b3' : colorForUserId(u.userId);
            return `<span class="doc-viewer-dot" style="background-color:${color}" title="${u.name}">${initial}</span>`;
        }).join('');
    });
}

export function getEditorColor(userId) {
    return colorForUserId(userId);
}