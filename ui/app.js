function addSection(title, info, highestInfo, parent) {
  const section = document.createElement('div');
  const heading = document.createElement('h3');
  heading.textContent = title;
  section.appendChild(heading);

  const list = document.createElement('ul');

  const countItem = createListItem(
    info.count,
    info.count,
    highestInfo.count,
    '#',
  );
  list.appendChild(countItem);

  const sizeInKB = info.size / 1024;
  const sizeText =
    sizeInKB > 1024 ? formatNumber(sizeInKB / 1024) : formatNumber(sizeInKB);
  const sizeItem = createListItem(
    sizeText,
    info.size,
    highestInfo.size,
    sizeInKB > 1024 ? 'MB' : 'KB',
  );
  list.appendChild(sizeItem);

  section.appendChild(list);
  parent.appendChild(section);
}

function formatNumber(num) {
  return num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function createListItem(content, value, highestValue, footer) {
  const listItem = document.createElement('li');
  const paragraph = document.createElement('p');

  if (value < highestValue) {
    listItem.classList.add('low');
  }

  paragraph.textContent = content;
  listItem.appendChild(paragraph);
  const footerElement = document.createElement('footer');
  footerElement.textContent = footer;
  listItem.appendChild(footerElement);
  return listItem;
}

function renderPodCard(data, podName, content, highestContent) {
  const pod = data[podName];
  const card = document.createElement('div');
  card.classList.add('card');
  card.classList.add(pod.phase.toLowerCase());
  card.classList.add(pod.ready ? 'ready' : 'not-ready');

  const header = document.createElement('h2');
  header.classList.add('card-header');

  const headline = document.createElement('p');
  headline.classList.add('card-header-title');
  headline.textContent = podName;
  header.appendChild(headline);

  card.appendChild(header);

  if (pod.phase === 'Running' && pod.ready) {
    addSection('Source', pod.source, highestContent.source, card);
    addSection('Target', pod.target, highestContent.target, card);
  }

  content.appendChild(card);
}

async function fetchData() {
  try {
    const response = await fetch('/cache/all');
    const data = await response.json();

    const content = document.createElement('div');
    content.classList.add('cards');

    const sortedPodNames = Object.keys(data).sort();

    const highestContent = {
      source: {
        count: 0,
        size: 0,
      },
      target: {
        count: 0,
        size: 0,
      },
    };

    sortedPodNames.forEach((podName) => {
      const podData = data[podName];

      if (podData.phase === 'Running' && podData.ready) {
        highestContent.source.count = Math.max(
          highestContent.source.count,
          podData.source.count,
        );
        highestContent.source.size = Math.max(
          highestContent.source.size,
          podData.source.size,
        );
        highestContent.target.count = Math.max(
          highestContent.target.count,
          podData.target.count,
        );
        highestContent.target.size = Math.max(
          highestContent.target.size,
          podData.target.size,
        );
      }

      renderPodCard(data, podName, content, highestContent);
    });

    document.getElementById('app').replaceChildren(content);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

fetchData();

setInterval(fetchData, 500);
