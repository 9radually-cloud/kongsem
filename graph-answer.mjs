export function getTutorGraphData(question, graphs) {
  if (/월요일|화요일|수요일|목요일|월-화|화-수|수-목|요일/.test(question)) return graphs.weekdayTemperatures;
  if (/\d+시|시간별|시간에 따른/.test(question)) return graphs.hourlyCounts;
  return graphs.monthlyTemperatures;
}

export function graphTutorReply(question, mode, graphs) {
  const graph = getTutorGraphData(question, graphs);
  const matchedIndexes = graph.labels.map((label, index) => question.includes(label)
    || (graph.id === 'weekdayTemperatures' && question.includes(label[0])) ? index : -1).filter((index) => index >= 0);
  const unit = graph.unit;
  if (matchedIndexes.length >= 2) {
    const [firstIndex, secondIndex] = matchedIndexes.slice(0, 2);
    const difference = graph.values[secondIndex] - graph.values[firstIndex];
    const change = difference === 0
      ? '두 값은 같아요.'
      : `${graph.labels[secondIndex]}의 값이 ${Math.abs(difference)}${unit}${difference > 0 ? ' 더 커요' : ' 더 작아요'}.`;
    return { text: `${graph.labels[firstIndex]}은 ${graph.values[firstIndex]}${unit}, ${graph.labels[secondIndex]}은 ${graph.values[secondIndex]}${unit}예요. ${change}`, actions: 'check' };
  }
  if (/가장.*높|가장 큰 값|최고|최댓/.test(question)) {
    const index = graph.values.indexOf(Math.max(...graph.values));
    return { text: `${graph.labels[index]}의 값이 ${graph.values[index]}${unit}로 가장 높아요. 세로축 눈금에서 점의 높이를 읽었어요.`, actions: 'check' };
  }
  if (/가장.*낮|가장 작은 값|최저|최솟/.test(question)) {
    const index = graph.values.indexOf(Math.min(...graph.values));
    return { text: `${graph.labels[index]}의 값이 ${graph.values[index]}${unit}로 가장 낮아요. 세로축 눈금에서 점의 높이를 읽었어요.`, actions: 'check' };
  }
  if (/오른|올라|증가/.test(question)) {
    const changes = graph.values.slice(1).map((value, index) => value - graph.values[index]);
    const index = changes.indexOf(Math.max(...changes));
    return { text: `${graph.labels[index]}에서 ${graph.labels[index + 1]}까지 ${graph.values[index]}${unit}에서 ${graph.values[index + 1]}${unit}로 ${changes[index]}${unit} 올랐어요.`, actions: 'check' };
  }
  if (/내린|내려|감소/.test(question)) {
    const changes = graph.values.slice(1).map((value, index) => value - graph.values[index]);
    const index = changes.indexOf(Math.min(...changes));
    return changes[index] < 0
      ? { text: `${graph.labels[index]}에서 ${graph.labels[index + 1]}까지 ${graph.values[index]}${unit}에서 ${graph.values[index + 1]}${unit}로 ${Math.abs(changes[index])}${unit} 내렸어요.`, actions: 'check' }
      : { text: '이 그래프에서는 값이 내려가는 구간이 없어요.', actions: 'check' };
  }
  if (matchedIndexes.length === 1) {
    const index = matchedIndexes[0];
    if (mode === 'teach') {
      const afterLabel = question.slice(question.indexOf(graph.labels[index]) + graph.labels[index].length);
      const claimed = afterLabel.match(/(?:은|는|이|가)?\s*(\d+)\s*(?:도|개|점)/);
      if (claimed) {
        const isCorrect = Number(claimed[1]) === graph.values[index];
        return { text: isCorrect ? `맞아요. ${graph.labels[index]}의 점은 세로축 ${graph.values[index]}${unit} 눈금에 있어요.` : `그래프를 다시 읽어볼게요. ${graph.labels[index]}의 점은 ${graph.values[index]}${unit}를 가리켜요.`, actions: 'check' };
      }
    }
    return { text: `${graph.labels[index]}의 값은 ${graph.values[index]}${unit}예요. 점에서 왼쪽으로 가로선을 따라 세로축 눈금을 읽으면 알 수 있어요.`, actions: 'check' };
  }
  if (mode === 'stuck') {
    const index = Math.min(2, graph.labels.length - 1);
    return { text: `힌트: 가로축에서 ${graph.labels[index]}을 찾고, 그 점에서 왼쪽으로 따라가 세로축 눈금을 읽어봐요. 이 그래프에서 그 값은 ${graph.values[index]}${unit}예요.`, actions: 'check' };
  }
  return { text: `${graph.title}예요. ${graph.labels.map((label, index) => `${label}은 ${graph.values[index]}${unit}`).join(', ')}예요. 점에서 왼쪽으로 가로선을 따라 세로축 눈금을 읽으면 각 값을 확인할 수 있어요.`, actions: 'check' };
}
