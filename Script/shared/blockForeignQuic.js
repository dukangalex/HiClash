const blockForeignQuic = [
  'AND,((NETWORK,UDP),(DST-PORT,443),(NOT,((OR,((RULE-SET,cn),(RULE-SET,cn_additional),(RULE-SET,cn_ip,no-resolve)))))),REJECT',
];
