import { initBlockTypingEvent, typingTimeout } from '/js/editor.js';
import { initDragAndDrop } from '/js/dragdrop.js';
import { moveCursorToStart, moveCursorToEnd } from '/js/utils.js';

export let stompClient = null;
export let currentDocId = null;

// ⚡ 웹소켓 서버 연결 및 구독 설정
export function connectWebSocket(docId) {
    currentDocId = docId;
    const workspaceId = document.getElementById('workspace-info').dataset.workspaceId;
    const socket = new SockJS('/ws-connect');
    stompClient = Stomp.over(socket);

    stompClient.connect({}, function (frame) {
        console.log("웹소켓 연결 성공:", frame);
        
        stompClient.subscribe('/topic/documents/' + docId, function (response) {
            const message = JSON.parse(response.body);

            if (message.status === "RENAME") {
                console.log("📥 [RENAME 수신] 문서ID:", message.documentId, "내용:", message.content);
                
                // 메인 화면 업데이트
                const displayTitle = document.getElementById('display-title');
                if (displayTitle) displayTitle.innerText = message.content;

                // 사이드바 업데이트
                const sidebarTitles = document.querySelectorAll('.sidebar-doc-title');
                sidebarTitles.forEach(el => {
                    // [디버깅] el.getAttribute('data-doc-id') 값과 message.documentId가 실제로 일치하는지 확인
                    const targetId = el.getAttribute('data-doc-id');
                    if (targetId == message.documentId) { // == 연산자로 느슨한 비교
                        console.log("✅ 사이드바 제목 업데이트 대상 발견!");
                        el.innerText = message.content;
                    }
                });
            }
            // [1] UPDATE 수신
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
            // [2] CREATE 수신
            else if (message.status === "CREATE") {
                if (!message.blockId) return;
                if (document.getElementById('block-' + message.blockId)) return;

                const currentActive = document.activeElement;
                let myActiveBlockId = null;
                
                if (currentActive && currentActive.classList.contains('editor-block-item')) {
                    myActiveBlockId = currentActive.getAttribute('data-block-id');
                }

                const newBlockHtml = `
                    <div class="block-wrapper">
                        <div class="block-actions" contenteditable="false">
                            <button class="plus-btn" onclick="toggleBlockMenu(event, ${message.blockId})">＋</button>
                            <div class="drag-handle">⠿</div>
                            <div id="menu-${message.blockId}" class="block-menu">
                                <button type="button" class="menu-item" onclick="changeBlockTypeFromMenu(${message.blockId}, 'H1')"><span class="menu-icon">H1</span> 대제목</button>
                                <button type="button" class="menu-item" onclick="changeBlockTypeFromMenu(${message.blockId}, 'H2')"><span class="menu-icon">H2</span> 중제목</button>
                                <button type="button" class="menu-item" onclick="changeBlockTypeFromMenu(${message.blockId}, 'H3')"><span class="menu-icon">H3</span> 소제목</button>
                                <button type="button" class="menu-item" onclick="changeBlockTypeFromMenu(${message.blockId}, 'TEXT')"><span class="menu-icon">T</span> 본문 텍스트</button>
                            </div>
                        </div>
                        <div class="editor-block-item ${message.blockType ? message.blockType.toLowerCase() : 'text'}" 
                            id="block-${message.blockId}" contenteditable="true" 
                            data-block-id="${message.blockId}" data-block-type="${message.blockType || 'TEXT'}" 
                            data-sequence-order="${message.sequenceOrder}" placeholder="명령어 사용은 '/' 입력">${message.content || ''}</div>
                    </div>`;

                const editorContainer = document.getElementById('editor-blocks');
                let inserted = false;

                if (myActiveBlockId) {
                    const activeBlock = document.getElementById('block-' + myActiveBlockId);
                    if (activeBlock) {
                        const activeWrapper = activeBlock.closest('.block-wrapper');
                        if (activeWrapper) {
                            activeWrapper.insertAdjacentHTML('afterend', newBlockHtml);
                            inserted = true;
                        }
                    }
                }

                if (!inserted) {
                    const items = Array.from(editorContainer.querySelectorAll('.editor-block-item'));
                    for (let item of items) {
                        if (parseInt(item.getAttribute('data-sequence-order')) > parseInt(message.sequenceOrder)) {
                            item.closest('.block-wrapper').insertAdjacentHTML('beforebegin', newBlockHtml);
                            inserted = true;
                            break;
                        }
                    }
                }
                
                if (!inserted) editorContainer.insertAdjacentHTML('beforeend', newBlockHtml);

                const newlyCreatedBlock = document.getElementById('block-' + message.blockId);
                if (newlyCreatedBlock && myActiveBlockId !== null) {
                    newlyCreatedBlock.focus();
                    moveCursorToStart(newlyCreatedBlock);
                }
            }
            // [3] DELETE 수신
            else if (message.status === "DELETE") {
                    const targetBlock = document.getElementById('block-' + message.blockId);
                    if (!targetBlock) return;

                    const currentActive = document.activeElement;
                    const currentWrapper = targetBlock.closest('.block-wrapper');
                    let previousBlock = null;
                    
                    if (currentWrapper && currentWrapper.previousElementSibling) {
                        previousBlock = currentWrapper.previousElementSibling.querySelector('.editor-block-item');
                    }

                    if (currentWrapper) currentWrapper.remove();

                    if (currentActive && currentActive.id === 'block-' + message.blockId && previousBlock) {
                        previousBlock.focus();
                        moveCursorToEnd(previousBlock);
                    }
            }
            // [4] REORDER 수신
            else if (message.status === "REORDER") {
                if (message.orderedBlocks && Array.isArray(message.orderedBlocks)) {
                    const container = document.getElementById('editor-blocks');
                    message.orderedBlocks.forEach((info) => {
                        const targetBlock = document.getElementById('block-' + info.blockId);
                        if (targetBlock) {
                            targetBlock.setAttribute('data-sequence-order', info.sequenceOrder);
                            const wrapper = targetBlock.closest('.block-wrapper');
                            if (wrapper && document.activeElement !== targetBlock) {
                                container.appendChild(wrapper); 
                            }
                        }
                    });
                }
            }
        });

        stompClient.subscribe('/topic/workspaces/' + workspaceId, function(response){
            const message = JSON.parse(response.body);
            
            if (message.status === "DELETE" && !message.blockId) {
                console.log("📄 워크스페이스 삭제 신호 수신:", message.documentId);
                
                // 사이드바에서 제거
                const sidebarTitles = document.querySelectorAll('.sidebar-doc-title');
                sidebarTitles.forEach(el => {
                    if (String(el.getAttribute('data-doc-id')) === String(message.documentId)) {
                        el.closest('li').remove();
                    }
                });

                // 보고 있던 문서가 삭제된 경우 이동
                if (currentDocId == message.documentId) {
                    alert("문서가 삭제되었습니다.");
                    window.location.href = '/workspaces/' + workspaceId + '/documents';
                }
            }
        });
        // 타 부속 모듈들의 이벤트 리스너 한 번에 시동 걸기
        initBlockTypingEvent(docId);
        initDragAndDrop(docId); 

    }, function(error){
        console.error("웹소켓 연결 실패:", error);
    });
}