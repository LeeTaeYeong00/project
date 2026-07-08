const colorPalette = ['#2383e2', '#e2618b', '#2eb872', '#e2a53a', '#8a63d2', '#e0555c'];

function colorForUserId(userId) {
    const index = Math.abs(Number(userId)) % colorPalette.length;
    return colorPalette[index];
}

export function renderPresence(users) {
    const list = document.getElementById('presence-list');
    if (!list) return;

    list.innerHTML = users.map(u => {
        const initial = (u.name || '?').charAt(0);
        const isVisitor = u.role === 'VISITOR';
        const color = isVisitor ? '#b7b7b3' : colorForUserId(u.userId);
        return `
            <div class="presence-avatar ${isVisitor ? 'visitor' : ''}" style="background-color:${color}">
                ${initial}
                <span class="tooltip">${u.name}${isVisitor ? ' (읽기 전용)' : ''}</span>
            </div>
        `;
    }).join('');
}

export function getEditorColor(userId) {
    return colorForUserId(userId);
}