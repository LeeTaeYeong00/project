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
                            placeholder="명령어 사용은 '/' 입력 (준비 중)">${message.content || ''}</div>
                    </div>
                `;

                const editorContainer = document.getElementById('editor-blocks');
                let inserted = false;

                // 1️⃣ [보완] 내가 방금 엔터를 친 블록이 있다면, 순서 비교 없이 무조건 그 블록 '바로 뒤'에 꽂습니다.
                // 이 방식이 꼬임 없는 노션식 인라인 삽입의 핵심입니다.
                if (myActiveBlockId) {
                    const activeBlock = document.getElementById('block-' + myActiveBlockId);
                    if (activeBlock) {
                        const activeWrapper = activeBlock.closest('.block-wrapper');
                        if (activeWrapper) {
                            activeWrapper.insertAdjacentHTML('afterend', newBlockHtml); // 내 블록 '바로 뒤(afterend)'에 삽입
                            inserted = true;
                        }
                    }
                }

                // 2️⃣ [백업/타인용] 내가 엔터 친 게 아니거나(다른 유저가 추가한 경우), 기준 블록을 못 찾았을 때만 순서 순회 정렬을 합니다.
                if (!inserted) {
                    const items = Array.from(editorContainer.querySelectorAll('.editor-block-item'));
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
                }
                
                // 3️⃣ [최종 백업] 위 두 개가 모두 실패하면 맨 마지막에 붙입니다.
                if (!inserted) {
                    editorContainer.insertAdjacentHTML('beforeend', newBlockHtml);
                }

                const newlyCreatedBlock = document.getElementById('block-' + message.blockId);
                
                if (newlyCreatedBlock) {
                    // 포커스 이동 조건 보완: 내가 엔터를 쳤던 상황이라면 확실하게 새 블록으로 포커스를 넘겨줍니다.
                    if (myActiveBlockId !== null) {
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
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);

            // 📍 커서가 현재 입력창의 맨 앞에 위치해 있고, 블록 지정 선택이 없는 상태인지 검사
            if (range.startOffset === 0 && range.collapsed) {
                const currentWrapper = targetBlock.closest('.block-wrapper');
                if (!currentWrapper) return;

                // 바로 위에 붙어있는 이전 블록 wrapper 찾기
                const previousWrapper = currentWrapper.previousElementSibling;
                if (!previousWrapper || !previousWrapper.classList.contains('block-wrapper')) return;

                const previousBlock = previousWrapper.querySelector('.editor-block-item');
                if (!previousBlock) return;

                // 브라우저 기본 백스페이스 동작 제어 (글자 지워짐 방지)
                event.preventDefault();
                clearTimeout(typingTimeout);

                const currentBlockId = targetBlock.getAttribute('data-block-id');
                const previousBlockId = previousBlock.getAttribute('data-block-id');
                const previousBlockType = previousBlock.getAttribute('data-block-type') || 'TEXT';

                // 1️⃣ [핵심] 병합 직전, 윗 블록의 진짜 마지막 "텍스트 지점" 또는 위치 확보
                let targetNode = previousBlock.lastChild;
                let targetOffset = 0;

                if (targetNode) {
                    if (targetNode.nodeType === Node.TEXT_NODE) {
                        targetOffset = targetNode.textContent.length;
                    } else if (targetNode.nodeName === 'BR') {
                        // 만약 Shift+Enter 상태로 끝났다면, 브라우저가 인식을 잘 하도록 부모 노드 기준으로 잡음
                        targetNode = previousBlock;
                        targetOffset = previousBlock.childNodes.length;
                    }
                } else {
                    targetNode = previousBlock;
                    targetOffset = 0;
                }

                // 2️⃣ [수정] DOM을 파괴하지 않고 자연스럽게 이어붙이기 (innerHTML += 금지)
                // 아래 블록의 자식 노드들을 안전하게 복사해서 윗 블록 끝에 붙입니다.
                const fragment = document.createDocumentFragment();
                while (targetBlock.firstChild) {
                    fragment.appendChild(targetBlock.firstChild);
                }
                
                // 윗 블록의 기존 노드들을 유지한 채로 자식들만 뒤에 추가 (참조가 깨지지 않음)
                previousBlock.appendChild(fragment);

                // 로컬 UI에서 아래 블록 라인 제거
                targetBlock.setAttribute('data-is-deleting', 'true');
                currentWrapper.remove();

                // 3️⃣ 🪄 커서를 이전 블록과 현재 내용이 합쳐진 접합부로 정확히 이동
                previousBlock.focus();
                const newRange = document.createRange();
                const newSelection = window.getSelection();

                try {
                    // 노드가 파괴되지 않았기 때문에 기존에 기억해둔 targetNode 가 그대로 유효합니다!
                    newRange.setStart(targetNode, targetOffset);
                    newRange.collapse(true);
                    newSelection.removeAllRanges();
                    newSelection.addRange(newRange);
                } catch (err) {
                    console.warn("⚠️ 기본 매핑 실패, 역산 백업 매커니즘 실행");
                    // 만약의 상황을 대비한 텍스트 노드 역산 처리
                    let lastTextNode = previousBlock.lastChild;
                    while (lastTextNode && lastTextNode.nodeType !== Node.TEXT_NODE && lastTextNode.hasChildNodes()) {
                        lastTextNode = lastTextNode.lastChild;
                    }
                    if (lastTextNode && lastTextNode.nodeType === Node.TEXT_NODE) {
                        const currentTextLength = targetBlock.innerText.length;
                        const safeOffset = Math.max(0, lastTextNode.textContent.length - currentTextLength);
                        newRange.setStart(lastTextNode, safeOffset);
                        newRange.collapse(true);
                        newSelection.removeAllRanges();
                        newSelection.addRange(newRange);
                    }
                }

                // 4️⃣ 🚀 실시간 웹소켓(STOMP)을 통한 양방향 데이터 동기화 전송
                if (stompClient && stompClient.connected) {
                    const updatePayload = {
                        status: "UPDATE",
                        documentId: parseInt(docId),
                        blockId: parseInt(previousBlockId),
                        blockType: previousBlockType,
                        content: previousBlock.innerText
                    };
                    stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(updatePayload));

                    const deletePayload = {
                        status: "DELETE",
                        documentId: parseInt(docId),
                        blockId: parseInt(currentBlockId),
                        content: ""
                    };
                    stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(deletePayload));
                    
                    console.log(`🧩 블록 병합 완료: [${previousBlockId}] <- [${currentBlockId}]`);
                }
            }
        }

        // 1️⃣ Shift + Enter 처리 (블록 내 줄바꿈 허용)
        if (event.key === 'Enter' && event.shiftKey) {
            // 브라우저 기본 동작(기본적으로 contenteditable에서 shift+enter는 <br>을 삽입함)을 그대로 두되, 
            // 그냥 Enter 분기문으로 빠져서 블록이 쪼개지는 것을 방지하기 위해 이벤트를 전파하지 않고 리턴합니다.
            event.stopPropagation();
            return; 
        }

        // 2️⃣ ⬆️ 위쪽 방향키 (기존 유지)
        if (event.key === 'ArrowUp') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const rects = range.getClientRects();
            const currentWrapper = targetBlock.closest('.block-wrapper');
            if (!currentWrapper) return;

            const isBlockEmpty = targetBlock.innerText.trim() === '' || targetBlock.childNodes.length === 0;

            let isAtTrueFirstLine = false;
            if (!isBlockEmpty) {
                const preCaretRange = range.cloneRange();
                preCaretRange.selectNodeContents(targetBlock);
                preCaretRange.setEnd(range.startContainer, range.startOffset);
                
                const tempDiv = document.createElement('div');
                tempDiv.appendChild(preCaretRange.cloneContents());
                isAtTrueFirstLine = !tempDiv.innerHTML.includes('<br>') && !tempDiv.innerText.includes('\n');
            }

            const caretX = (rects.length > 0) ? rects[0].left : targetBlock.getBoundingClientRect().left + 5;
            const caretY = (rects.length > 0) ? rects[0].top : targetBlock.getBoundingClientRect().top;
            const blockRect = targetBlock.getBoundingClientRect();
            
            if (isBlockEmpty || (isAtTrueFirstLine && (caretY - blockRect.top < 22))) {
                const previousWrapper = currentWrapper.previousElementSibling;
                if (previousWrapper && previousWrapper.classList.contains('block-wrapper')) {
                    const previousBlock = previousWrapper.querySelector('.editor-block-item');
                    if (previousBlock) {
                        event.preventDefault();
                        
                        const prevRect = previousBlock.getBoundingClientRect();
                        const targetY = prevRect.bottom - 10;

                        previousBlock.focus();

                        if (previousBlock.innerText.trim() === '') {
                            moveCursorToEnd(previousBlock);
                            return;
                        }

                        let targetRange = null;
                        if (document.caretRangeFromPoint) {
                            targetRange = document.caretRangeFromPoint(caretX, targetY);
                        } else if (document.caretPositionFromPoint) {
                            const position = document.caretPositionFromPoint(caretX, targetY);
                            if (position) {
                                targetRange = document.createRange();
                                targetRange.setStart(position.offsetNode, position.offset);
                                targetRange.collapse(true);
                            }
                        }

                        if (targetRange && previousBlock.contains(targetRange.startContainer)) {
                            selection.removeAllRanges();
                            selection.addRange(targetRange);
                        } else {
                            moveCursorToEnd(previousBlock);
                        }
                        return;
                    }
                }
            }
        }

        // 3️⃣ ⬇️ 아래쪽 방향키 (★ 위쪽 방향키와 완벽한 대칭 구조로 수정)
        if (event.key === 'ArrowDown') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const rects = range.getClientRects();
            const currentWrapper = targetBlock.closest('.block-wrapper');
            if (!currentWrapper) return;

            const isBlockEmpty = targetBlock.innerText.trim() === '' || targetBlock.childNodes.length === 0;

            // 💡 [수정] 위쪽 방향키와 완전히 대칭되는 방식으로 커서 이후 영역을 검사합니다.
            let isAtTrueLastLine = false;
            if (!isBlockEmpty) {
                const postCaretRange = range.cloneRange();
                postCaretRange.selectNodeContents(targetBlock);
                postCaretRange.setStart(range.endContainer, range.endOffset); // 커서 뒤쪽 영역 지정
                
                const tempDiv = document.createElement('div');
                tempDiv.appendChild(postCaretRange.cloneContents());
                
                // 커서보다 뒷부분에 <br>이나 줄바꿈 문자가 없다면 진짜 마지막 줄입니다.
                // (브라우저가 자동으로 붙이는 마지막 찌꺼기 공백 <br> 하나만 남은 경우도 마지막 줄로 인정합니다)
                const htmlAfter = tempDiv.innerHTML.trim();
                if (htmlAfter === '<br>' || htmlAfter === '') {
                    isAtTrueLastLine = true;
                } else {
                    isAtTrueLastLine = !tempDiv.innerHTML.includes('<br>') && !tempDiv.innerText.includes('\n');
                }
            }

            const caretX = (rects.length > 0) ? rects[0].left : targetBlock.getBoundingClientRect().left + 5;
            const caretY = (rects.length > 0) ? rects[0].bottom : targetBlock.getBoundingClientRect().bottom;
            const blockRect = targetBlock.getBoundingClientRect();
            
            // 💡 [수정] 위쪽 방향키와 대칭되게 '진짜 마지막 줄'이면서 하단 경계선에 접근했을 때 탈출합니다.
            if (isBlockEmpty || (isAtTrueLastLine && (blockRect.bottom - caretY < 25))) {
                const nextWrapper = currentWrapper.nextElementSibling;
                if (nextWrapper && nextWrapper.classList.contains('block-wrapper')) {
                    const nextBlock = nextWrapper.querySelector('.editor-block-item');
                    if (nextBlock) {
                        // 🪄 조건을 만족하면 브라우저 기본 동작(끝으로 가기)을 즉시 봉쇄합니다.
                        event.preventDefault();
                        
                        const nextRect = nextBlock.getBoundingClientRect();
                        const targetY = nextRect.top + 10;

                        nextBlock.focus();

                        if (nextBlock.innerText.trim() === '') {
                            moveCursorToStart(nextBlock);
                            return;
                        }

                        let targetRange = null;
                        if (document.caretRangeFromPoint) {
                            targetRange = document.caretRangeFromPoint(caretX, targetY);
                        } else if (document.caretPositionFromPoint) {
                            const position = document.caretPositionFromPoint(caretX, targetY);
                            if (position) {
                                targetRange = document.createRange();
                                targetRange.setStart(position.offsetNode, position.offset);
                                targetRange.collapse(true);
                            }
                        }

                        if (targetRange && nextBlock.contains(targetRange.startContainer)) {
                            selection.removeAllRanges();
                            selection.addRange(targetRange);
                        } else {
                            moveCursorToStart(nextBlock);
                        }
                        return;
                    }
                }
            }
        }

        // ↵ 일반 Enter 처리 (블록 쪼개기)
        if (event.key === 'Enter') {
            event.preventDefault(); // 브라우저의 오동작 및 개행 삽입 원천 봉쇄

            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            
            // 1️⃣ 커서 위치부터 블록의 맨 끝까지의 범위를 지정합니다.
            const nextLinesRange = range.cloneRange();
            nextLinesRange.selectNodeContents(targetBlock);
            nextLinesRange.setStart(range.endContainer, range.endOffset);

            // 2️⃣ 커서 뒤에 있는 콘텐츠를 뜯어냅니다.
            const fragment = nextLinesRange.extractContents();
            
            // 3️⃣ 🪄 [핵심] 끌려온 맨 앞의 불필요한 <br> 제거
            if (fragment.firstChild && fragment.firstChild.nodeName === 'BR') {
                fragment.removeChild(fragment.firstChild);
            } else if (fragment.firstChild && fragment.firstChild.nodeType === Node.TEXT_NODE && fragment.firstChild.textContent === '') {
                if (fragment.firstChild.nextSibling && fragment.firstChild.nextSibling.nodeName === 'BR') {
                    fragment.removeChild(fragment.firstChild.nextSibling);
                }
            }

            // 앞쪽에 남은 텍스트 (줄바꿈 \n 유지)
            const frontText = targetBlock.innerText;
            
            // 4️⃣ 🪄 [오류 수정] innerText 대신 fragment 내부의 텍스트 노드와 <br>을 직접 \n로 파싱
            let backText = "";
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(fragment);

            // 자식 노드를 직접 돌면서 <br>을 만날 때마다 확실하게 \n을 더해줍니다.
            tempDiv.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    backText += node.textContent;
                } else if (node.nodeName === 'BR') {
                    backText += "\n";
                } else {
                    // 혹시 모를 내부 div/span 대비
                    backText += node.innerText || "";
                }
            });

            const currentBlockId = targetBlock.getAttribute('data-block-id');
            const currentBlockType = targetBlock.getAttribute('data-block-type') || 'TEXT';

            // 5️⃣ 현재 블록 업데이트 (소켓 전송)
            if (stompClient && stompClient.connected) {
                const updatePayload = {
                    status: "UPDATE",
                    documentId: parseInt(docId),
                    blockId: parseInt(currentBlockId),
                    blockType: currentBlockType,
                    content: frontText
                };
                stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(updatePayload));
            }

            // 6️⃣ 뒷부분 텍스트(backText)를 들고 새 블록 생성 요청
            if (stompClient && stompClient.connected) {
                const createPayload = {
                    status: "CREATE",
                    documentId: parseInt(docId),
                    targetBlockId: parseInt(currentBlockId), 
                    blockType: "TEXT",
                    content: backText // 이제 \n이 정확히 포함된 데이터가 전송됩니다.
                };
                stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(createPayload));
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
    if (!element) return;
    
    element.focus();
    
    const selection = window.getSelection();
    const range = document.createRange();
    
    // 💡 핵심: element의 마지막 자식 노드를 추적합니다.
    if (element.hasChildNodes()) {
        let lastNode = element.lastChild;
        
        // 만약 맨 마지막에 의미 없는 빈 텍스트 노드가 붙어있다면 진짜 컨텐츠 노드로 한 칸 앞으로 이동
        while (lastNode && lastNode.nodeType === Node.TEXT_NODE && lastNode.textContent === '') {
            lastNode = lastNode.previousSibling;
        }
        
        if (lastNode) {
            if (lastNode.nodeType === Node.TEXT_NODE) {
                // 마지막 노드가 일반 텍스트면, 그 텍스트의 글자 수 맨 끝에 커서를 놓습니다.
                range.setStart(lastNode, lastNode.textContent.length);
            } else {
                // 마지막 노드가 <br>이나 다른 태그라면, 그 태그 바로 뒤(오른쪽)에 커서를 놓습니다.
                range.setStartAfter(lastNode);
            }
        } else {
            // 자식 노드 필터링 후 아무것도 남지 않았다면 엘리먼트 자체의 0번 위치로
            range.setStart(element, 0);
        }
    } else {
        // 내부에 글자가 아예 없는 텅 빈 블록인 경우
        range.selectNodeContents(element);
    }
    
    range.collapse(true); // 커서 형태로 축소 (블록 지정 해제)
    selection.removeAllRanges();
    selection.addRange(range);
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
    
    // 1. 다른 모든 메뉴 일단 닫기
    document.querySelectorAll('.block-menu').forEach(menu => {
        if(menu.id !== 'menu-' + blockId) menu.classList.remove('show');
    });

    const currentMenu = document.getElementById('menu-' + blockId);
    if (!currentMenu) return;

    // 2. 토글 처리
    const isOpening = !currentMenu.classList.contains('show');
    
    if (isOpening) {
        currentMenu.classList.add('show');
        document.body.classList.add('menu-active');

        // 💡 [핵심]: 클릭한 버튼의 뷰포트 절대 좌표를 가져옵니다.
        const rect = event.currentTarget.getBoundingClientRect();
        
        // 3. 부모 요소를 탈출시켜 body 기준으로 위치를 고정해버립니다.
        // 스크롤 위치(window.scrollY/scrollX)까지 더해 가둠을 완벽히 방지합니다.
        currentMenu.style.position = 'fixed';
        currentMenu.style.top = (rect.bottom + window.scrollY + 5) + 'px'; // 버튼 바로 아래 5px 여백
        currentMenu.style.left = (rect.left + window.scrollX) + 'px';
        
        // 메뉴판이 화면 밖으로 나가는걸 막기 위해 body 바로 아래로 레이어를 이동시킬 수도 있습니다.
        document.body.appendChild(currentMenu);
    } else {
        currentMenu.classList.remove('show');
        document.body.classList.remove('menu-active');
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
    document.body.classList.remove('menu-active');
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