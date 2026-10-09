(() => {
  const $ = (selector) => document.querySelector(selector);
  const pegs = [...document.querySelectorAll('.peg')];
  const colors = ['#e5ad68', '#e68268', '#cf735f', '#82a9a3', '#4d908d', '#2c7375', '#315f70', '#264d60'];
  const names = ['A 起點', 'B 中繼', 'C 終點'];
  let diskCount = 3;
  let stacks = [];
  let selected = null;
  let moves = 0;
  let autoTimer = null;
  let autoRunning = false;
  let activeAnimation = null;
  let hintMove = null;

  const levelOptions = $('#level-options');
  for (let count = 3; count <= 8; count++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level-button';
    button.textContent = count;
    button.setAttribute('aria-label', `${count} 片圓盤`);
    button.setAttribute('aria-pressed', String(count === diskCount));
    button.addEventListener('click', () => {
      diskCount = count;
      levelOptions.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      $('#setup-detail').textContent = `${count} 片圓盤，最少需要 ${2 ** count - 1} 步`;
    });
    levelOptions.append(button);
  }

  function say(message) { $('#game-message').textContent = message; }
  function stopAuto() {
    clearTimeout(autoTimer);
    autoTimer = null;
    autoRunning = false;
    activeAnimation?.cancel();
    $('#auto-button').innerHTML = '<span aria-hidden="true">▶</span> 自動完成';
    $('#hint-button').disabled = false;
    $('#reset-button').disabled = false;
    pegs.forEach((peg) => { peg.disabled = false; });
  }
  function render() {
    pegs.forEach((peg, index) => {
      const stack = peg.querySelector('.disk-stack');
      stack.replaceChildren();
      stacks[index].forEach((size) => {
        const disk = document.createElement('span');
        disk.className = 'disk';
        disk.style.width = `${29 + size * (63 / diskCount)}%`;
        disk.style.background = colors[(size - 1) % colors.length];
        disk.setAttribute('aria-hidden', 'true');
        stack.append(disk);
      });
      peg.classList.toggle('selected', selected === index);
      peg.classList.toggle('hint-from', hintMove?.from === index);
      peg.classList.toggle('hint-to', hintMove?.to === index);
      peg.setAttribute('aria-label', `${names[index]}，${stacks[index].length} 片圓盤${selected === index ? '，已選取' : ''}`);
    });
    $('#move-count').textContent = moves;
  }
  function resetGame() {
    stopAuto();
    stacks = [Array.from({length: diskCount}, (_, i) => diskCount - i), [], []];
    selected = null;
    hintMove = null;
    moves = 0;
    $('#minimum-count').textContent = 2 ** diskCount - 1;
    $('#disk-count').innerHTML = `${diskCount} <small>片</small>`;
    $('#win-banner').hidden = true;
    say('先點選有圓盤的柱子，再點選要放置的柱子。');
    render();
  }
  function isSolved() { return stacks[2].length === diskCount; }
  function completeGame() {
    stopAuto();
    selected = null;
    hintMove = null;
    render();
    $('#win-detail').textContent = `你用了 ${moves} 步完成 ${diskCount} 片圓盤的挑戰${moves === 2 ** diskCount - 1 ? '，剛好是最少步數！' : '！'}`;
    $('#win-banner').hidden = false;
    say('挑戰成功！所有圓盤都移到終點了。');
  }
  function moveDisk(from, to) {
    if (from === to || !stacks[from].length) return false;
    const size = stacks[from].at(-1);
    if (stacks[to].length && stacks[to].at(-1) < size) return false;
    stacks[to].push(stacks[from].pop());
    moves++;
    selected = null;
    hintMove = null;
    render();
    if (isSolved()) completeGame();
    else say(`已將圓盤從 ${names[from]} 移到 ${names[to]}。`);
    return true;
  }
  function getSolution() {
    const positions = Array(diskCount + 1);
    stacks.forEach((stack, peg) => stack.forEach((size) => { positions[size] = peg; }));
    const path = [];
    function moveTower(n, from, to) {
      if (!n) return;
      const spare = 3 - from - to;
      moveTower(n - 1, from, spare);
      path.push({from, to});
      positions[n] = to;
      moveTower(n - 1, spare, to);
    }
    function solveCurrent(n, target) {
      if (!n) return;
      const source = positions[n];
      if (source === target) { solveCurrent(n - 1, target); return; }
      const spare = 3 - source - target;
      solveCurrent(n - 1, spare);
      path.push({from: source, to: target});
      positions[n] = target;
      moveTower(n - 1, spare, target);
    }
    solveCurrent(diskCount, 2);
    return path;
  }

  async function animateDisk(from, to) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    const sourceDisk = pegs[from].querySelector('.disk-stack .disk:last-child');
    if (!sourceDisk?.animate) return true;

    const targetStack = pegs[to].querySelector('.disk-stack');
    const sourceRect = sourceDisk.getBoundingClientRect();
    const targetRect = targetStack.getBoundingClientRect();
    const boardRect = $('#board').getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(targetStack).rowGap) || 0;
    const targetTop = targetRect.bottom - sourceRect.height - stacks[to].length * (sourceRect.height + gap);
    const dx = targetRect.left + (targetRect.width - sourceRect.width) / 2 - sourceRect.left;
    const dy = targetTop - sourceRect.top;
    const lift = Math.min(-25, boardRect.top + 8 - sourceRect.top);

    const flyingDisk = sourceDisk.cloneNode(true);
    flyingDisk.classList.add('flying-disk');
    flyingDisk.style.left = `${sourceRect.left}px`;
    flyingDisk.style.top = `${sourceRect.top}px`;
    flyingDisk.style.width = `${sourceRect.width}px`;
    flyingDisk.style.height = `${sourceRect.height}px`;
    document.body.append(flyingDisk);
    sourceDisk.style.visibility = 'hidden';

    const animation = flyingDisk.animate([
      { transform: 'translate(0, 0)', offset: 0 },
      { transform: `translate(0, ${lift}px)`, offset: .28 },
      { transform: `translate(${dx}px, ${lift}px)`, offset: .72 },
      { transform: `translate(${dx}px, ${dy}px)`, offset: 1 }
    ], { duration: diskCount >= 7 ? 460 : 680, easing: 'ease-in-out', fill: 'forwards' });
    activeAnimation = animation;
    try {
      await animation.finished;
      return true;
    } catch {
      return false;
    } finally {
      if (activeAnimation === animation) activeAnimation = null;
      flyingDisk.remove();
      sourceDisk.style.visibility = '';
    }
  }

  pegs.forEach((peg) => peg.addEventListener('click', () => {
    if (autoRunning || isSolved()) return;
    const index = Number(peg.dataset.peg);
    hintMove = null;
    if (selected === null) {
      if (!stacks[index].length) { say('這根柱子沒有圓盤，請選擇有圓盤的柱子。'); render(); return; }
      selected = index;
      say(`已選取 ${names[index]}，現在點選目的柱。`);
      render();
    } else if (selected === index) {
      selected = null;
      say('已取消選取，請重新選擇起始柱。');
      render();
    } else if (!moveDisk(selected, index)) {
      say('大圓盤不能放在小圓盤上，請選擇其他柱子。');
      render();
    }
  }));

  $('#hint-button').addEventListener('click', () => {
    if (isSolved()) return;
    const next = getSolution()[0];
    if (!next) return;
    selected = null;
    hintMove = next;
    render();
    say(`提示：把 ${names[next.from]} 最上面的圓盤移到 ${names[next.to]}。`);
  });
  $('#auto-button').addEventListener('click', () => {
    if (autoRunning) { stopAuto(); say('自動完成已暫停，你可以繼續自己移動。'); return; }
    if (isSolved()) return;
    autoRunning = true;
    selected = null;
    hintMove = null;
    render();
    pegs.forEach((peg) => { peg.disabled = true; });
    $('#hint-button').disabled = true;
    $('#reset-button').disabled = true;
    $('#auto-button').innerHTML = '<span aria-hidden="true">Ⅱ</span> 暫停動畫';
    say('正在自動完成，按「暫停動畫」可以繼續自己玩。');
    const path = getSolution();
    let step = 0;
    const advance = async () => {
      if (!autoRunning || step >= path.length) return;
      const {from, to} = path[step++];
      if (!await animateDisk(from, to) || !autoRunning) return;
      moveDisk(from, to);
      if (autoRunning) autoTimer = setTimeout(advance, 90);
    };
    autoTimer = setTimeout(advance, 180);
  });
  $('#reset-button').addEventListener('click', resetGame);
  $('#play-again-button').addEventListener('click', resetGame);
  $('#start-button').addEventListener('click', () => {
    $('#setup-screen').hidden = true;
    $('#game-screen').hidden = false;
    document.body.classList.add('playing');
    resetGame();
    if (window.matchMedia('(max-width: 800px)').matches) $('#game-title').scrollIntoView({behavior: 'smooth', block: 'start'});
  });
  $('#change-level-button').addEventListener('click', () => {
    stopAuto();
    $('#game-screen').hidden = true;
    $('#setup-screen').hidden = false;
    document.body.classList.remove('playing');
    if (window.matchMedia('(max-width: 800px)').matches) $('#setup-title').scrollIntoView({behavior: 'smooth', block: 'center'});
  });
})();
