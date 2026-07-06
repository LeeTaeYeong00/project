import { stompClient } from '/js/websocket.js';

// 🫳 노션 스타일 드래그 앤 드롭 엔진 초기화
export function initDragAndDrop(docId) {
    const container = document.getElementById('editor-blocks');
    if (!container) return;

    // 🔥 [핵심 체크] 글로벌 영역에 Sortable이 로드되었는지 명확히 확인
    const SortableLib = window.Sortable || (typeof Sortable !== 'undefined' ? Sortable : null);
    
    if (!SortableLib) {
        console.error("🚨 Sortable 라이브러리가 로드되지 않았습니다! HTML 상단의 스크립트 태그를 확인하세요.");
        return;
    }

    // Sortable 라이브러리가 전역(window.Sortable)에 로드되어 있다고 가정합니다.
    new Sortable(container, {
        handle: '.drag-handle', 
        animation: 150,         
        ghostClass: 'block-ghost', 
        chosenClass: 'block-chosen',
        
        onEnd: function (evt) {
            const movedBlock = evt.item.querySelector('.editor-block-item');
            if (!movedBlock) return;

            const blockId = movedBlock.getAttribute('data-block-id');
            
            const allBlocks = Array.from(container.querySelectorAll('.editor-block-item'));
            const blockOrderPayload = allBlocks.map((block, index) => {
                block.setAttribute('data-sequence-order', index);
                return {
                    blockId: parseInt(block.getAttribute('data-block-id')),
                    sequenceOrder: index 
                };
            });

            console.log("🔄 드래그 완료! 새 순서 데이터:", blockOrderPayload);

            if (stompClient && stompClient.connected) {
                const payload = {
                    status: "REORDER",
                    documentId: parseInt(docId),
                    orderedBlocks: blockOrderPayload 
                };
                stompClient.send('/app/documents/' + docId + '/typing', {}, JSON.stringify(payload));
                console.log("🚀 웹소켓으로 REORDER 신호를 보냈습니다.");
            }
        }
    });
}