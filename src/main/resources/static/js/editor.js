let stompClient = null;
let typingTimeout = null;

// ⚡ 웹소켓 연결 및 실시간 문서방 구독
function connectWebSocket(docId) {
    const socket = new SockJS('/ws-connect');
    stompClient = Stomp.over(socket);

    stompClient.connect({}, function (frame) {
        console.log("웹소켓 연결 성공. 프레임 정보 : ", frame);
        
        stompClient.subscribe('/topic/documents/' + docId, function (response) {
            const message = JSON.parse(response.body);

            // 1) 블록 수정 (UPDATE) 수신 처리
            if (message.status === "UPDATE") {
                const targetBlock = document.getElementById('block-' + message.blockId);
                if (targetBlock) {
                    if (document.activeElement !== targetBlock) {
                        targetBlock.innerText = message.content;
                    }
                    targetBlock.className = 'editor-block-item ' + (message.blockType ? message.blockType.toLowerCase() : 'text');
                    targetBlock.setAttribute('data-block-type', message.blockType || 'TEXT');
                }
            }
            // 2) 새 블록 생성 (CREATE) 수신 처리
            else if (message.status === "CREATE") {
                if (!message.blockId) {
                    console.error("❌ [오류] 서버로부터 올바른 blockId를 받지 못했습니다:", message);
                    return;
                }

                if (document.getElementById('block-' + message.blockId)) return;

                const currentActive = document.activeElement;
                let myActiveBlockId = null;
                let myActiveSequence = null;
                
                if (currentActive && currentActive.classList.contains('editor-block-item')) {
                    myActiveBlockId = currentActive.getAttribute('data-block-id');
                    myActiveSequence = currentActive.getAttribute('data-sequence-order');
                }

                const newBlockHtml = `
                    <div class="block-wrapper">
                        <div class="block-actions" contenteditable="false">
                            <button class="plus-btn" onclick="toggleBlockMenu(event, ${message.blockId})">＋</button>
                            <div class="drag-handle" style="cursor: grab; color: #91908c; padding: 2px 4px; font-size: 14px; user-select: none;">⠿</div>
                            <div id="menu-${message.blockId}" class="block-menu">
                                <button type="button" class="menu-item" onclick="changeBlockTypeFromMenu(${message.blockId}, 'H1')"><span class="menu-icon">H1</span> 대제목</button>
                                <button type="button" class="menu-item" onclick="changeBlockTypeFromMenu(${message.blockId}, 'H2')"><span class="menu-icon">H2</span> 중제목</button>
                                <button type="button" class="menu-item" onclick="changeBlockTypeFromMenu(${message.blockId}, 'H3')"><span class="menu-icon">H3</span> 소제목</button>
                                <button type="button" class="menu-item" onclick="changeBlockTypeFromMenu(${message.blockId}, 'TEXT')"><span class="menu-icon">T</span> 본문 텍스트</button>
                            </div>
                        </div>

                        <div class="editor-block-item ${message.blockType ? message.blockType.toLowerCase() : 'text'}" 
                            id="block-${message.blockId}" 
                            contenteditable="true" 
                            data-block-id="${message.blockId}" 
                            data-block-type="${message.blockType || 'TEXT'}" 
                            data-sequence-order="${message.sequenceOrder}"
                            placeholder="명령어 사용은 '/' 입력 (준비 중)"></div>
                    </div>
                `;

                const editorContainer = document.getElementById('editor-blocks');
                const items = Array.from(editorContainer.querySelectorAll('.editor-block-item'));
                let inserted = false;
                
                for (let item of items) {
                    if (parseInt(item.getAttribute('data-sequence-order')) > parseInt(message.sequenceOrder)) {
                        const itemWrapper = item.closest('.block-wrapper');
                        if (itemWrapper) {
                            itemWrapper.insertAdjacentHTML('beforebegin', newBlockHtml);
                            inserted = true;
                            break;
                        }
                    }
                }
                
                if (!inserted) {
                    editorContainer.insertAdjacentHTML('beforeend', newBlockHtml);
                }

                const newlyCreatedBlock = document.getElementById('block-' + message.blockId);
                
                if (newlyCreatedBlock) {
                    if (myActiveSequence !== null && parseInt(message.sequenceOrder) === parseInt(myActiveSequence) + 1) {
                        newlyCreatedBlock.focus();
                        moveCursorToStart(newlyCreatedBlock);
                        console.log(`➡️ [포커스 이동] 내가 만든 블록[${message.blockId}]으로 커서 이동 완료`);
                    } else {
                        console.log(`👥 [타인 블록 추가] 다른 유저가 만든 블록[${message.blockId}] 화면 배치 완료`);
                    }
                }
            }
            // 3) 블록 삭제 (DELETE) 수신 처리
            else if (message.status === "DELETE") {
                const targetBlock = document.getElementById('block-' + message.blockId);
                if (!targetBlock) return;

                const currentActive = document.activeElement;
                const currentWrapper = targetBlock.closest('.block-wrapper');
                
                let previousBlock = null;
                if (currentWrapper && currentWrapper.previousElementSibling) {
                    previousBlock = currentWrapper.previousElementSibling.querySelector('.editor-block-item');
                }

                if (currentWrapper) {
                    currentWrapper.remove();
                } else {
                    targetBlock.remove();
                }

                if (currentActive && currentActive.id === 'block-' + message.blockId && previousBlock) {
                    previousBlock.focus();
                    moveCursorToEnd(previousBlock);
                }
            }
            // 🔄 4) [추가] 실시간 드래그 앤 드롭 (REORDER) 수신 처리
            else if (message.status === "REORDER") {
                console.log("👥 다른 유저에 의해 순서가 변경되었습니다. 데이터를 반영합니다.");
                if (message.orderedBlocks && Array.isArray(message.orderedBlocks)) {
                    const container = document.getElementById('editor-blocks');
                    
                    // 수신된 순서(orderedBlocks)대로 실제 DOM 안의 block-wrapper 들을 재배치하고 sequence-order 속성을 동기화합니다.
                    message.orderedBlocks.forEach((info) => {
                        const targetBlock = document.getElementById('block-' + info.blockId);
                        if (targetBlock) {
                            // 최신 순서값 업데이트
                            targetBlock.setAttribute('data-sequence-order', info.sequenceOrder);
                            
                            // 현재 포커스 상태가 아닌 경우에만 DOM 정렬 수행하여 타이핑 흐름 방해 금지
                            const wrapper = targetBlock.closest('.block-wrapper');
                            if (wrapper && document.activeElement !== targetBlock) {
                                container.appendChild(wrapper); 
                            }
                        }
                    });
                }
            }
        });

        initBlockTypingEvent(docId);
        initDragAndDrop(docId); // 여기서 드래그 앤 드롭 기능이 정상 활성화됩니다.

    }, function(error){
        console.log("웹소켓 연결 실패 : ", error);
    });
}

// 🧱 키보드 및 마우스 조작 핵심 이벤트 관리 레이어
function initBlockTypingEvent(docId) {
    const editorContainer = document.getElementById('editor-blocks');
    if (!editorContainer) return;

    function flushPendingChanges(block) {
        if (!block || !block.classList.contains('editor-block-item')) return;
        if (block.getAttribute('data-is-deleting') === 'true') return;
        
        clearTimeout(typingTimeout);
        
        const blockId = block.getAttribute('data-block-id');
        const blockType = block.getAttribute('data-block-type') || 'TEXT';
        const content = block.innerText;

        if (stompClient && stompClient.connected && blockId) {
            const payload = {
                status: "UPDATE",
                documentId: parseInt(docId),
                blockId: parseInt(blockId),
                blockType: blockType,
                content: content
            };
            stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(payload));
            console.log(`🎯 [동기화 완료] 블록[${blockId}] 저장:`, content);
        }
    }

    editorContainer.addEventListener('input', function (event) {
        const targetBlock = event.target;
        if (targetBlock.classList.contains('editor-block-item')) {
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(function () {
                flushPendingChanges(targetBlock);
            }, 300);
        }
    });

    editorContainer.addEventListener('keydown', function (event) {
        const targetBlock = event.target;
        if (!targetBlock.classList.contains('editor-block-item')) return;

        if (event.key === ' ' || event.key === 'Enter') {
            const text = targetBlock.innerText.trim();
            let newType = null;

            if (text === '/h1') newType = 'H1';
            else if (text === '/h2') newType = 'H2';
            else if (text === '/h3') newType = 'H3';
            else if (text === '/text') newType = 'TEXT';

            if (newType) {
                event.preventDefault(); 
                targetBlock.innerText = '';
                targetBlock.className = 'editor-block-item ' + newType.toLowerCase();
                targetBlock.setAttribute('data-block-type', newType);

                const blockId = targetBlock.getAttribute('data-block-id');
                if (stompClient && stompClient.connected && blockId) {
                    const payload = {
                        status: "UPDATE",
                        documentId: parseInt(docId),
                        blockId: parseInt(blockId),
                        blockType: newType,
                        content: ""
                    };
                    stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(payload));
                    console.log(`🎨 [타입 전환] 블록[${blockId}] -> ${newType}`);
                }
                return; 
            }
        }

        if (event.key === 'Backspace') {
            if (targetBlock.innerText.trim().length === 0) {
                const currentWrapper = targetBlock.closest('.block-wrapper');
                if (!currentWrapper) return;

                const previousWrapper = currentWrapper.previousElementSibling;
                if (!previousWrapper || !previousWrapper.classList.contains('block-wrapper')) return;

                const previousBlock = previousWrapper.querySelector('.editor-block-item');
                if (!previousBlock) return;

                event.preventDefault();
                clearTimeout(typingTimeout);
                targetBlock.setAttribute('data-is-deleting', 'true');

                const blockId = targetBlock.getAttribute('data-block-id');
                if (stompClient && stompClient.connected && blockId) {
                    const payload = {
                        status: "DELETE",
                        documentId: parseInt(docId),
                        blockId: parseInt(blockId),
                        content: ""
                    };
                    stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(payload));
                    console.log(`❌ 블록[${blockId}] 삭제 요청 전송`);
                }
            }
        }

        else if (event.key === 'Enter' && !event.isComposing) {
            event.preventDefault();
            flushPendingChanges(targetBlock);

            const blockType = targetBlock.getAttribute('data-block-type') || 'TEXT';
            const sequenceOrder = targetBlock.getAttribute('data-sequence-order') || '0';

            if (stompClient && stompClient.connected) {
                const payload = {
                    status: "CREATE",
                    documentId: parseInt(docId),
                    blockType: blockType,
                    sequenceOrder: parseInt(sequenceOrder),
                    content: ""
                };
                stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(payload));
                console.log(`✨ 새 블록 생성 요청 전송 (Order: ${sequenceOrder})`);
            }
        }
    });

    editorContainer.addEventListener('focusout', function (event) {
        if (event.target.classList.contains('editor-block-item')) {
            flushPendingChanges(event.target);
        }
    });
}

function moveCursorToEnd(element) {
    try {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (e) { console.error(e); }
}

function moveCursorToStart(element) {
    try {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (e) { console.error(e); }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleBtn');
    sidebar.classList.toggle('collapsed');
    if (sidebar.classList.contains('collapsed')) {
        toggleBtn.innerText = '▶';
    } else {
        toggleBtn.innerText = '◀';
    }
}

function toggleBlockMenu(event, blockId) {
    event.stopPropagation(); 
    
    document.querySelectorAll('.block-menu').forEach(menu => {
        if(menu.id !== 'menu-' + blockId) menu.classList.remove('show');
    });

    const currentMenu = document.getElementById('menu-' + blockId);
    if (currentMenu) {
        currentMenu.classList.toggle('show');
    }
}

function changeBlockTypeFromMenu(blockId, newType) {
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

document.addEventListener('click', function() {
    document.querySelectorAll('.block-menu').forEach(menu => {
        menu.classList.remove('show');
    });
});

// 💡 노션 스타일 드래그 앤 드롭 엔진 초기화 함수 (오타 수정 버전)
function initDragAndDrop(docId) {
    const container = document.getElementById('editor-blocks');
    if (!container) return;

    new Sortable(container, {
        handle: '.drag-handle', 
        animation: 150,         
        ghostClass: 'block-ghost', 
        
        onEnd: function (evt) {
            const movedBlock = evt.item.querySelector('.editor-block-item');
            if (!movedBlock) return;

            const blockId = movedBlock.getAttribute('data-block-id');
            
            // 전체 블록의 변경된 순서를 다시 수집하여 배열 생성
            const allBlocks = Array.from(container.querySelectorAll('.editor-block-item'));
            const blockOrderPayload = allBlocks.map((block, index) => {
                // 수집과 동시에 로컬 요소들의 속성값도 미리 최신 인덱스로 동기화해 줍니다.
                block.setAttribute('data-sequence-order', index);
                return {
                    blockId: parseInt(block.getAttribute('data-block-id')),
                    sequenceOrder: index 
                };
            });

            console.log("🔄 드래그 완료! 변경된 새 순서 데이터 배열:", blockOrderPayload);

            if (stompClient && stompClient.connected) {
                const payload = {
                    status: "REORDER",
                    documentId: parseInt(docId),
                    // ⚙️ [수정 완료]: 변수명을 blockOrderPayload 로 정확히 일치시켰습니다!
                    orderedBlocks: blockOrderPayload 
                };
                stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(payload));
                console.log("🚀 웹소켓으로 REORDER 신호를 보냈습니다.");
            }
        }
    });
}