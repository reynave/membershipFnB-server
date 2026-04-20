
### RULES SQL query
query sql wajib mengunakan konsep ini
```
`SELECT COALESCE(SUM(pointIn), 0) AS totalPointIn, 
        COALESCE(SUM(pointOut), 0) AS totalPointOut 
        FROM points WHERE memberId = ${memberId} 
        AND archived = 0 AND presence = 1`;
```
dilarang mengunakan ini 
```
 'SELECT id, transactionId, merchantId, tierId, pointIn, pointOut, transactionDate, note FROM points WHERE memberId = ? AND archived = 0 ORDER BY transactionDate DESC',
      [memberId]
```
karean susah di console.log jika ada bugs query

    