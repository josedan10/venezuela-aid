/** Human-readable label: requested catalog item, optional matched offer when different. */
export function formatNeedItemLabel(needItem) {
  const requested = needItem.item?.name || needItem.resource?.name || 'Ítem';
  const qty = needItem.quantity;

  if (!needItem.matchedResourceId) {
    return `${qty}x ${requested}`;
  }

  const offerName = needItem.matchedResource?.item?.name || needItem.matchedResource?.name;
  if (offerName && offerName !== requested) {
    return `${qty}x ${requested} → ${offerName}`;
  }

  return `${qty}x ${requested}`;
}

export function isNeedItemMatched(needItem) {
  return Boolean(needItem.matchedResourceId);
}
