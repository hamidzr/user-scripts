hmd = hmd || {};
if (hmd.download === undefined) {
  hmd.download = (filename, text) => {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  };
}

const getRows = () => {
  document
    .querySelectorAll('#holdings .pc-holdings-grid-cell--holding-description')
    .forEach((el) => {
      el.remove();
    });

  let rows = Array.from(
    document.querySelectorAll('#holdings .table__body.qa-datagrid-rows .table__row '),
  );

  rows = rows.map((row) => Array.from(row.querySelectorAll('.qa-holding-shares, .qa-ticker')));

  return rows.map((row) => row.map((el) => el.textContent).join(', '));
};

function main() {
  const rows = getRows().join('\n');
  const header = `symbol, shares\n`;
  // use the loaded browser-mods from hamidzr/user-script to download the resulting csv
  hmd.download('holdings.csv', header + rows);
}

main();
