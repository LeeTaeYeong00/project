import { stompClient, currentDocId } from '/js/websocket.js';

// 🗂️ 좌측 사이드바 토글
export function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleBtn');
    if (!sidebar || !toggleBtn) return;

    sidebar.classList.toggle('collapsed');
    toggleBtn.innerText = sidebar.classList.contains('collapsed') ? '▶' : '◀';
}

// 팝업 메뉴 열기/닫기
export function toggleBlockMenu(event, blockId) {
    event.stopPropagation(); 
    
    document.querySelectorAll('.block-menu').forEach(menu => {
        if(menu.id !== 'menu-' + blockId) menu.classList.remove('show');
    });

    const currentMenu = document.getElementById('menu-' + blockId);
    if (!currentMenu) return;

    const isOpening = !currentMenu.classList.contains('show');
    
    if (isOpening) {
        currentMenu.classList.add('show');
        document.body.classList.add('menu-active');

        const rect = event.currentTarget.getBoundingClientRect();
        
        currentMenu.style.position = 'fixed';
        currentMenu.style.top = (rect.bottom + window.scrollY + 5) + 'px'; 
        currentMenu.style.left = (rect.left + window.scrollX) + 'px';
        
        document.body.appendChild(currentMenu);
    } else {
        currentMenu.classList.remove('show');
        document.body.classList.remove('menu-active');
    }
}

// 메뉴 내부에서 타입 전환 클릭 시 실행
export function changeBlockTypeFromMenu(blockId, newType) {
    const targetBlock = document.getElementById('block-' + blockId);
    if (!targetBlock) return;

    targetBlock.className = 'editor-block-item ' + newType.toLowerCase();
    targetBlock.setAttribute('data-block-type', newType);

    if (stompClient && stompClient.connected && currentDocId) {
        const payload = {
            status: "UPDATE",
            documentId: parseInt(currentDocId),
            blockId: parseInt(blockId),
            blockType: newType,
            content: targetBlock.innerText
        };
        stompClient.send('/app/documents/' + currentDocId + '/typing', {}, JSON.stringify(payload));
        console.log(`🎨 [메뉴 전환 완료] 블록[${blockId}] -> ${newType}`);
    }

    const currentMenu = document.getElementById('menu-' + blockId);
    if (currentMenu) currentMenu.classList.remove('show');
}

// 글로벌 메뉴 닫기 이벤트 등록
document.addEventListener('click', function() {
    document.querySelectorAll('.block-menu').forEach(menu => {
        menu.classList.remove('show');
    });
    document.body.classList.remove('menu-active');
});

// 🔍 슬래시 명령어 메뉴 생성 및 필터링 적용
export function showSlashMenu(targetBlock, filterText = "") {
    // 기존 메뉴가 있다면 제거 (필터링 갱신을 위해 다시 그림)
    hideSlashMenu();

    const menu = document.createElement('div');
    menu.id = 'slash-command-menu';
    menu.className = 'slash-menu';

    // 정의된 메뉴 항목 리스트
    const menuItems = [
        { type: 'H1', label: '대제목' },
        { type: 'H2', label: '중제목' },
        { type: 'H3', label: '소제목' },
        { type: 'TEXT', label: '본문 텍스트' }
    ];

    // 필터링된 항목 생성
    const filteredItems = menuItems.filter(item => 
        ('/' + item.type.toLowerCase()).startsWith('/' + filterText.toLowerCase())
    );

    // 조건에 맞는 항목이 없으면 메뉴를 만들지 않음
    if (filteredItems.length === 0) return;

    // 메뉴 아이템 렌더링
    menu.innerHTML = filteredItems.map((item, index) => `
        <div class="slash-item ${index === 0 ? 'active' : ''}" data-type="${item.type}">
            <span class="menu-icon">${item.type === 'TEXT' ? 'T' : item.type}</span> ${item.label}
        </div>
    `).join('');

    document.body.appendChild(menu);

    // 📍 좌표 계산 (기존 로직 유지)
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (rect.bottom + 5) + 'px';
        menu.style.left = rect.left + 'px';
    } else {
        const blockRect = targetBlock.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = (blockRect.bottom) + 'px';
        menu.style.left = (blockRect.left + 10) + 'px';
    }
}

// 🔍 슬래시 메뉴 숨기기
export function hideSlashMenu() {
    const menu = document.getElementById('slash-command-menu');
    if (menu) menu.remove();
}

export function toggleTitleEdit() {
    const displayTitle = document.getElementById('display-title');
    const editInput = document.getElementById('edit-title-input');
    const editBtn = document.getElementById('edit-title-btn');
    
    // 💡 버튼에서 docId 가져오기
    const docId = editBtn.getAttribute('data-doc-id');

    const isEditing = editInput.style.display !== 'none';

    if (isEditing) {
        // [저장 시점] 서버로 데이터 전송
        const newTitle = editInput.value;
        
        if (stompClient && stompClient.connected) {
            const payload = {
                status: "RENAME",
                documentId: parseInt(docId),
                content: newTitle
            };
            stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(payload));
        }

        displayTitle.innerText = newTitle;
        displayTitle.style.display = 'block';
        editInput.style.display = 'none';
        editBtn.innerText = '✏️';
    } else {
        // [수정 시작]
        editInput.value = displayTitle.innerText;
        displayTitle.style.display = 'none';
        editInput.style.display = 'block';
        editInput.focus();
        editBtn.innerText = '💾';
    }
}

// 외부에서 꺼내 쓸 수 있도록 window에 바인딩
window.hideSlashMenu = hideSlashMenu;

// ⚡ 중요: 분할된 모듈 함수들을 HTML 인라인 태그(onclick 등)가 접근할 수 있도록 글로벌 영역(window)에 명시적 등록
window.toggleSidebar = toggleSidebar;
window.toggleBlockMenu = toggleBlockMenu;
window.changeBlockTypeFromMenu = changeBlockTypeFromMenu;

// 에디터 내부적으로 혹시 모를 누락을 방지하기 위한 안전장치 추가
console.log("✅ UI 및 팝업 메뉴 제어 모듈이 글로벌 영역에 바인딩되었습니다.");