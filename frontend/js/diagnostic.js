// Diagnostic script - check if StorageDynamoDB has load() method
console.log('=== DIAGNOSTIC START ===');
console.log('StorageDynamoDB class:', typeof StorageDynamoDB);
if (typeof StorageDynamoDB === 'function') {
    const testInstance = new StorageDynamoDB();
    console.log('load method exists:', typeof testInstance.load);
    console.log('load is function:', typeof testInstance.load === 'function');
    console.log('All methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(testInstance)));
}
console.log('=== DIAGNOSTIC END ===');
