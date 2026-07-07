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
    
    const docId = editBtn.getAttribute('data-doc-id');
    const isEditing = editInput.style.display !== 'none';

    // 저장 로직을 함수로 분리 (중복 제거)
    const saveTitle = () => {
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
    };

    if (isEditing) {
        saveTitle();
    } else {
        // [수정 시작]
        editInput.value = displayTitle.innerText;
        displayTitle.style.display = 'none';
        editInput.style.display = 'block';
        editInput.focus();
        editBtn.innerText = '💾';

        // 💡 엔터키 이벤트 추가
        editInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                saveTitle();
            }
        };
    }
}

// 기존 toggleMenu 함수 수정
export function toggleMenu(event, btn) {
    event.preventDefault();
    event.stopPropagation(); // 이벤트가 부모(링크)로 퍼지는 것 방지

    const docId = btn.getAttribute('data-doc-id');
    const menu = document.getElementById('menu-' + docId);
    
    // 버튼 하이라이트 토글
    btn.classList.toggle('active');

    // 다른 메뉴 닫기 및 하이라이트 해제
    document.querySelectorAll('.doc-menu-popup').forEach(m => {
        if (m !== menu) m.style.display = 'none';
    });
    document.querySelectorAll('.doc-menu-btn').forEach(b => {
        if (b !== btn) b.classList.remove('active');
    });

    // 현재 메뉴 토글
    menu.style.display = (menu.style.display === 'none') ? 'block' : 'none';
}

// 💡 [핵심] 메뉴 밖 어디든 클릭하면 닫히게 하는 전역 이벤트
document.addEventListener('click', (event) => {
    const menus = document.querySelectorAll('.doc-menu-popup');
    const buttons = document.querySelectorAll('.doc-menu-btn');

    // 클릭한 요소가 메뉴나 버튼 내부가 아니라면 전부 닫기
    if (!event.target.closest('.doc-menu-popup') && !event.target.closest('.doc-menu-btn')) {
        menus.forEach(m => m.style.display = 'none');
        buttons.forEach(b => b.classList.remove('active'));
    }
});

// 2. 삭제/이름변경 로직 (서버 호출)
export function deleteDocFromSidebar(btn) {
    const docId = btn.closest('.doc-menu-popup').id.replace('menu-', '');
    if (confirm("정말 삭제하시겠습니까?")) {
        // 서버의 DELETE 엔드포인트 호출 또는 웹소켓 전송
        console.log("삭제 요청:", docId);
    }
}

// 외부에서 꺼내 쓸 수 있도록 window에 바인딩
window.hideSlashMenu = hideSlashMenu;

// ⚡ 중요: 분할된 모듈 함수들을 HTML 인라인 태그(onclick 등)가 접근할 수 있도록 글로벌 영역(window)에 명시적 등록
window.toggleSidebar = toggleSidebar;
window.toggleBlockMenu = toggleBlockMenu;
window.changeBlockTypeFromMenu = changeBlockTypeFromMenu;
window.toggleMenu = toggleMenu;

// [이름 변경 시작 로직]
window.prepareRename = function(btn) {
    const docId = btn.getAttribute('data-doc-id');
    const titleSpan = document.querySelector(`.sidebar-doc-title[data-doc-id="${docId}"]`);
    
    // 1. 기존 제목을 input으로 교체
    const wrapper = document.createElement('span');
    const input = document.createElement('input');
    const saveBtn = document.createElement('button');
    
    input.value = titleSpan.innerText;
    input.className = 'rename-input';
    saveBtn.innerText = '저장';
    saveBtn.style.marginLeft = '5px';
    
    // [중요] input에서 클릭 이벤트 전파 차단
    wrapper.onclick = (e) => e.stopPropagation();
    
    wrapper.appendChild(input);
    wrapper.appendChild(saveBtn);
    titleSpan.parentNode.replaceChild(wrapper, titleSpan);
    
    // [중요] 포커스를 확실히 주고, blur 이벤트가 너무 빨리 동작하지 않게 함
    setTimeout(() => input.focus(), 10);

    const performSave = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (stompClient && stompClient.connected) {
            const payload = {
                status: "RENAME",
                documentId: parseInt(docId),
                content: input.value
            };
            stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(payload));
        }
        wrapper.parentNode.replaceChild(titleSpan, wrapper);
        titleSpan.innerText = input.value;
    };

    input.onkeydown = (e) => {
        if(e.key === 'Enter'){
            performSave(e);
        }
    }

    saveBtn.onclick = performSave;
    
    // 2. 다른 곳 클릭 시 취소 로직 강화
    input.onblur = (e) => {
        // 저장 버튼을 누른 게 확실할 때만 취소 안 함
        setTimeout(() => {
            if (document.activeElement !== saveBtn && wrapper.parentNode) {
                wrapper.parentNode.replaceChild(titleSpan, wrapper);
            }
        }, 200);
    };

    document.getElementById('menu-' + docId).style.display = 'none';
};

// [삭제 로직]
window.deleteDocFromSidebar = function(btn) {
    event.preventDefault();
    event.stopPropagation();
    const docId = btn.getAttribute('data-doc-id');
    if (confirm("정말 삭제하시겠습니까?")) {
        stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify({
            status: "DELETE",
            documentId: parseInt(docId)
        }));
        // 삭제 후 화면 업데이트는 서버에서 받아오는 웹소켓 메시지(DELETE 리스트 갱신)로 처리하세요.
    }
};

// 에디터 내부적으로 혹시 모를 누락을 방지하기 위한 안전장치 추가
console.log("✅ UI 및 팝업 메뉴 제어 모듈이 글로벌 영역에 바인딩되었습니다.");