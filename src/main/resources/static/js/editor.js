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
                if (document.getElementById('block-' + message.blockId)) return;

                const newBlockHtml = `
                    <div class="editor-block-item" 
                         id="block-${message.blockId}" 
                         contenteditable="true" 
                         data-block-id="${message.blockId}" 
                         data-block-type="${message.blockType}" 
                         data-sequence-order="${message.sequenceOrder}"
                         placeholder="명령어 사용은 '/' 입력 (준비 중)"></div>
                `;

                const editorContainer = document.getElementById('editor-blocks');
                const currentActive = document.activeElement;

                if (currentActive && currentActive.classList.contains('editor-block-item')) {
                    currentActive.insertAdjacentHTML('afterend', newBlockHtml);
                } else {
                    const items = Array.from(editorContainer.querySelectorAll('.editor-block-item'));
                    let inserted = false;
                    for (let item of items) {
                        if (parseInt(item.getAttribute('data-sequence-order')) > message.sequenceOrder) {
                            item.insertAdjacentHTML('beforebegin', newBlockHtml);
                            inserted = true;
                            break;
                        }
                    }
                    if (!inserted) {
                        editorContainer.insertAdjacentHTML('beforeend', newBlockHtml);
                    }
                }

                if (currentActive && currentActive.classList.contains('editor-block-item')) {
                    const newlyCreatedBlock = document.getElementById('block-' + message.blockId);
                    if (newlyCreatedBlock) {
                        newlyCreatedBlock.focus();
                        moveCursorToStart(newlyCreatedBlock);
                    }
                }
            }

            // 3) 블록 삭제 (DELETE) 수신 처리
            else if (message.status === "DELETE") {
                const targetBlock = document.getElementById('block-' + message.blockId);
                if (!targetBlock) return;

                const currentActive = document.activeElement;
                const previousBlock = targetBlock.previousElementSibling;

                targetBlock.remove();

                if (currentActive && currentActive.id === 'block-' + message.blockId && previousBlock) {
                    previousBlock.focus();
                    moveCursorToEnd(previousBlock);
                }
            }
        });

        initBlockTypingEvent(docId);

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
            console.log(`🎯 [강제 동기화] 블록[${blockId}] 즉시 저장 완료:`, content);
        }
    }

    // [1] 타이핑 디바운싱
    editorContainer.addEventListener('input', function (event) {
        const targetBlock = event.target;
        if (targetBlock.classList.contains('editor-block-item')) {
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(function () {
                flushPendingChanges(targetBlock);
            }, 300);
        }
    });

    // [2] 특수 단축키 및 개행 제어 엔진
    editorContainer.addEventListener('keydown', function (event) {
        const targetBlock = event.target;
        if (!targetBlock.classList.contains('editor-block-item')) return;

        // 💡 0순위: 슬래시 명령어 감지 인터셉터
        if (event.key === ' ' || event.key === 'Enter') {
            const text = targetBlock.innerText.trim();
            let newType = null;

            if (text === '/h1') newType = 'H1';
            else if (text === '/h2') newType = 'H2';
            else if (text === '/h3') newType = 'H3';
            else if (text === '/text') newType = 'TEXT';

            if (newType) {
                event.preventDefault(); // 공백이나 엔터 기입 방지
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
                return; // 타입이 바뀌었다면 아래 백스페이스/엔터생성 로직 실행 거부
            }
        }

        // 💡 1순위: 백스페이스 삭제 처리
        if (event.key === 'Backspace') {
            if (targetBlock.innerText.trim().length === 0) {
                const previousBlock = targetBlock.previousElementSibling;
                if (!previousBlock || !previousBlock.classList.contains('editor-block-item')) return;

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

        // 💡 2순위: 엔터 키를 누를 때 신규 블록 생성 처리 (명령어가 아닐 때만 도달해야 함)
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

    // [3] 포커스 아웃 백업 저장
    editorContainer.addEventListener('focusout', function (event) {
        if (event.target.classList.contains('editor-block-item')) {
            flushPendingChanges(event.target);
        }
    });
}

// 💡 커서를 끝으로 보내는 유틸
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

// 💡 커서를 시작점으로 모으는 유틸
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

// 🔐 [안전복구] 사이드바 토글 애니메이션 로직 통합
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