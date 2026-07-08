import { stompClient } from '/js/websocket.js';
import { moveCursorToEnd, moveCursorToStart } from '/js/utils.js';
import { showSlashMenu, hideSlashMenu, toggleTitleEdit } from '/js/ui.js'; // 💡 확장자 .js 명시 확인

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
        if (!targetBlock.classList.contains('editor-block-item')) return;

        const text = targetBlock.innerText;
        
        // 슬래시가 포함되어 있다면 필터링 모드 활성화
        if (text.includes('/')) {
            // 커서 위치의 텍스트가 '/'로 시작하거나 슬래시 뒤에 명령어가 있는 경우 추출
            const slashIndex = text.lastIndexOf('/');
            const filterText = text.substring(slashIndex + 1).trim();
            
            showSlashMenu(targetBlock, filterText);
        } else {
            hideSlashMenu();
        }

        // 기존 디바운싱 저장
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(function () {
            flushPendingChanges(targetBlock);
        }, 300);
    });
    
    // 2) 키보드 단축키 및 비즈니스 로직 제어
    editorContainer.addEventListener('keydown', function (event) {
        const targetBlock = event.target;
        if (!targetBlock.classList.contains('editor-block-item')) return;

        // 💡 실시간 슬래시 명령어 메뉴 객체 확인
        const slashMenu = document.getElementById('slash-command-menu');

        // ==========================================================================
        // 🔮 [A 파트] 슬래시 메뉴가 활성화되어 있을 때의 키보드 제어 (우선순위 1등)
        // ==========================================================================
        if (slashMenu) {
            const items = Array.from(slashMenu.querySelectorAll('.slash-item'));
            const activeIndex = items.findIndex(item => item.classList.contains('active'));

            // 메뉴 아래로 이동
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                items[activeIndex].classList.remove('active');
                const nextIndex = (activeIndex + 1) % items.length;
                items[nextIndex].classList.add('active');
                return; // 기존의 블록 아래 이동 로직으로 내려가지 않도록 차단
            }

            // 메뉴 위로 이동
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                items[activeIndex].classList.remove('active');
                const prevIndex = (activeIndex - 1 + items.length) % items.length;
                items[prevIndex].classList.add('active');
                return; // 기존의 블록 위 이동 로직으로 내려가지 않도록 차단
            }

            // 메뉴 닫기
            if (event.key === 'Escape') {
                event.preventDefault();
                hideSlashMenu();
                return;
            }

            // 선택 항목 확정 및 블록 변환
            if (event.key === 'Enter') {
                event.preventDefault();
                const activeItem = items[activeIndex];
                if (activeItem) {
                    const newType = activeItem.getAttribute('data-type');
                    
                    // 💡 수정 핵심: 명령어(/...)를 완전히 제거하고 텍스트 초기화
                    // 명령어 문자열을 찾아 삭제하는 정규식 사용
                    targetBlock.innerText = targetBlock.innerText.replace(/\/[a-zA-Z0-9]*/, '');
                    
                    // 블록 스타일 적용
                    targetBlock.className = 'editor-block-item ' + newType.toLowerCase();
                    targetBlock.setAttribute('data-block-type', newType);

                    // 서버 동기화
                    const blockId = targetBlock.getAttribute('data-block-id');
                    if (stompClient && stompClient.connected && blockId) {
                        const payload = {
                            status: "UPDATE",
                            documentId: parseInt(docId),
                            blockId: parseInt(blockId),
                            blockType: newType,
                            content: targetBlock.innerText
                        };
                        stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(payload));
                    }

                    // 💡 추가: 변환 후 커서를 텍스트 끝으로 이동 (필요 시)
                    moveCursorToEnd(targetBlock);
                    
                    hideSlashMenu();
                }
                return;
            }
        }

        // ==========================================================================
        // 🔍 [B 파트] 슬래시(/) 입력 실시간 트리거 및 지우기 감지
        // ==========================================================================
        if (event.key === '/') {
            setTimeout(() => {
                showSlashMenu(targetBlock, ""); // 처음 칠 때는 전체 메뉴 표시
            }, 10);
        }

        // Backspace로 문자를 지우다 '/'가 완전히 증발하면 팝업 자동 차단
        if (event.key === 'Backspace' && slashMenu) {
            setTimeout(() => {
                if (!targetBlock.innerText.includes('/')) {
                    hideSlashMenu();
                }
            }, 10);
        }


        // ==========================================================================
        // 🧱 [C 파트] 기존의 오리지널 블록 제어 비즈니스 로직 (메뉴가 닫혔을 때만 동작)
        // ==========================================================================
        
        // 백스페이스 (지우기 및 위 블록과 병합)
        if (event.key === 'Backspace' && !slashMenu) {
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
        if (event.key === 'ArrowUp' && !slashMenu) {
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
        if (event.key === 'ArrowDown' && !slashMenu) {
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
        if (event.key === 'Enter' && !slashMenu) {
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

            if (stompClient && stompClient.connected) {
                stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify({
                    status: "UPDATE", 
                    documentId: parseInt(docId), 
                    blockId: parseInt(currentBlockId), 
                    blockType: currentBlockType, 
                    content: frontText
                }));
                
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

    editorContainer.addEventListener('focusin', function (event) {
        const targetBlock = event.target;
        if (!targetBlock.classList.contains('editor-block-item')) return;

        const blockId = targetBlock.getAttribute('data-block-id');
        if (stompClient && stompClient.connected && blockId) {
            stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify({
                status: "EDIT_START",
                documentId: parseInt(docId),
                blockId: parseInt(blockId)
            }));
        }
    });

    // 3) 포커스 아웃 실시간 밀어넣기 및 슬래시 메뉴 청소
    editorContainer.addEventListener('focusout', function (event) {
        if (event.target.classList.contains('editor-block-item')) {
            flushPendingChanges(event.target);
            setTimeout(hideSlashMenu, 150);

            const blockId = event.target.getAttribute('data-block-id');
            if (stompClient && stompClient.connected && blockId) {
                stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify({
                    status: "EDIT_END",
                    documentId: parseInt(docId),
                    blockId: parseInt(blockId)
                }));
            }
        }
    });

    // 💡 에디터 외부 바탕을 눌렀을 때 팝업 차단용 글로벌 이벤트 리스너 추가
    document.addEventListener('click', function (e) {
        if (!e.target.closest('#slash-command-menu') && !e.target.classList.contains('editor-block-item')) {
            hideSlashMenu();
        }
    });
}

    document.addEventListener('DOMContentLoaded', () => {
        const editBtn = document.getElementById('edit-title-btn');
        if (editBtn) {
            editBtn.addEventListener('click', toggleTitleEdit);
        }
    }); 