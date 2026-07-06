import { stompClient } from '/js/websocket.js';
import { moveCursorToEnd, moveCursorToStart } from '/js/utils.js';

export let typingTimeout = null;

// 🧱 키보드 및 마우스 조작 이벤트 코어
export function initBlockTypingEvent(docId) {
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
            console.log(`🎯 [동기화 완료] 블록[${blockId}] 저장`);
        }
    }

    // 1) 텍스트 입력 디바운싱
    editorContainer.addEventListener('input', function (event) {
        const targetBlock = event.target;
        if (targetBlock.classList.contains('editor-block-item')) {
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(function () {
                flushPendingChanges(targetBlock);
            }, 300);
        }
    });

    // 2) 키보드 단축키 및 비즈니스 로직 제어
    editorContainer.addEventListener('keydown', function (event) {
        const targetBlock = event.target;
        if (!targetBlock.classList.contains('editor-block-item')) return;

        // 슬래시(/) 명령어 변환
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
                }
                return; 
            }
        }

        // 백스페이스 (지우기 및 위 블록과 병합)
        if (event.key === 'Backspace') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);

            if (range.startOffset === 0 && range.collapsed) {
                const currentWrapper = targetBlock.closest('.block-wrapper');
                if (!currentWrapper) return;

                const previousWrapper = currentWrapper.previousElementSibling;
                if (!previousWrapper || !previousWrapper.classList.contains('block-wrapper')) return;

                const previousBlock = previousWrapper.querySelector('.editor-block-item');
                if (!previousBlock) return;

                event.preventDefault();
                clearTimeout(typingTimeout);

                const currentBlockId = targetBlock.getAttribute('data-block-id');
                const previousBlockId = previousBlock.getAttribute('data-block-id');
                const previousBlockType = previousBlock.getAttribute('data-block-type') || 'TEXT';

                let targetNode = previousBlock.lastChild;
                let targetOffset = 0;

                if (targetNode) {
                    if (targetNode.nodeType === Node.TEXT_NODE) {
                        targetOffset = targetNode.textContent.length;
                    } else if (targetNode.nodeName === 'BR') {
                        targetNode = previousBlock;
                        targetOffset = previousBlock.childNodes.length;
                    }
                } else {
                    targetNode = previousBlock;
                    targetOffset = 0;
                }

                const fragment = document.createDocumentFragment();
                while (targetBlock.firstChild) {
                    fragment.appendChild(targetBlock.firstChild);
                }
                
                previousBlock.appendChild(fragment);
                targetBlock.setAttribute('data-is-deleting', 'true');
                currentWrapper.remove();

                previousBlock.focus();
                const newRange = document.createRange();
                const newSelection = window.getSelection();

                try {
                    newRange.setStart(targetNode, targetOffset);
                    newRange.collapse(true);
                    newSelection.removeAllRanges();
                    newSelection.addRange(newRange);
                } catch (err) {
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

                if (stompClient && stompClient.connected) {
                    stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify({
                        status: "UPDATE", documentId: parseInt(docId), blockId: parseInt(previousBlockId), blockType: previousBlockType, content: previousBlock.innerText
                    }));
                    stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify({
                        status: "DELETE", documentId: parseInt(docId), blockId: parseInt(currentBlockId), content: ""
                    }));
                }
            }
        }

        // Shift + Enter 처리 (블록 내 개행)
        if (event.key === 'Enter' && event.shiftKey) {
            event.stopPropagation();
            return; 
        }

        // 위쪽 방향키 이동
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
                        }
                        if (targetRange && previousBlock.contains(targetRange.startContainer)) {
                            selection.removeAllRanges();
                            selection.addRange(targetRange);
                        } else {
                            moveCursorToEnd(previousBlock);
                        }
                    }
                }
            }
        }

        // 아래쪽 방향키 이동
        if (event.key === 'ArrowDown') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const rects = range.getClientRects();
            const currentWrapper = targetBlock.closest('.block-wrapper');
            if (!currentWrapper) return;

            const isBlockEmpty = targetBlock.innerText.trim() === '' || targetBlock.childNodes.length === 0;
            let isAtTrueLastLine = false;
            
            if (!isBlockEmpty) {
                const postCaretRange = range.cloneRange();
                postCaretRange.selectNodeContents(targetBlock);
                postCaretRange.setStart(range.endContainer, range.endOffset); 
                const tempDiv = document.createElement('div');
                tempDiv.appendChild(postCaretRange.cloneContents());
                
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
            
            if (isBlockEmpty || (isAtTrueLastLine && (blockRect.bottom - caretY < 25))) {
                const nextWrapper = currentWrapper.nextElementSibling;
                if (nextWrapper && nextWrapper.classList.contains('block-wrapper')) {
                    const nextBlock = nextWrapper.querySelector('.editor-block-item');
                    if (nextBlock) {
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
                        }
                        if (targetRange && nextBlock.contains(targetRange.startContainer)) {
                            selection.removeAllRanges();
                            selection.addRange(targetRange);
                        } else {
                            moveCursorToStart(nextBlock);
                        }
                    }
                }
            }
        }

        // 엔터 키 처리 (블록 쪼개고 새로 생성하기)
        // ⚡ [체크포인트] editor.js 파일 내 Enter 키 매핑 파트
        if (event.key === 'Enter') {
            event.preventDefault(); 

            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const nextLinesRange = range.cloneRange();
            nextLinesRange.selectNodeContents(targetBlock);
            nextLinesRange.setStart(range.endContainer, range.startOffset);

            const fragment = nextLinesRange.extractContents();
            if (fragment.firstChild && fragment.firstChild.nodeName === 'BR') {
                fragment.removeChild(fragment.firstChild);
            }

            const frontText = targetBlock.innerText;
            let backText = "";
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(fragment);

            tempDiv.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) backText += node.textContent;
                else if (node.nodeName === 'BR') backText += "\n";
                else backText += node.innerText || "";
            });

            const currentBlockId = targetBlock.getAttribute('data-block-id');
            const currentBlockType = targetBlock.getAttribute('data-block-type') || 'TEXT';

            // 현재 블록 글자 업데이트 발송
            if (stompClient && stompClient.connected) {
                stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify({
                    status: "UPDATE", 
                    documentId: parseInt(docId), 
                    blockId: parseInt(currentBlockId), 
                    blockType: currentBlockType, 
                    content: frontText
                }));
                
                // 새 블록 생성(CREATE) 요청 발송
                stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify({
                    status: "CREATE", 
                    documentId: parseInt(docId), 
                    targetBlockId: parseInt(currentBlockId), 
                    blockType: "TEXT", 
                    content: backText
                }));
            }
        }
    });

    // 3) 포커스 아웃 실시간 밀어넣기
    editorContainer.addEventListener('focusout', function (event) {
        if (event.target.classList.contains('editor-block-item')) {
            flushPendingChanges(event.target);
        }
    });
}