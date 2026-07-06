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

// ⚡ 중요: 분할된 모듈 함수들을 HTML 인라인 태그(onclick 등)가 접근할 수 있도록 글로벌 영역(window)에 명시적 등록
window.toggleSidebar = toggleSidebar;
window.toggleBlockMenu = toggleBlockMenu;
window.changeBlockTypeFromMenu = changeBlockTypeFromMenu;

// 에디터 내부적으로 혹시 모를 누락을 방지하기 위한 안전장치 추가
console.log("✅ UI 및 팝업 메뉴 제어 모듈이 글로벌 영역에 바인딩되었습니다.");