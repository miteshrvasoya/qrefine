import { SQLRule } from "../types";
import { selectStarRule } from "./selectStar";
import { joinWithoutOnRule } from "./joinWithoutOn";
import { likeLeadingPercentRule } from "./likeLeadingPercent";
import { orderByWithoutLimitRule } from "./orderByWithoutLimit";
import { deleteWithoutWhereRule } from "./deleteWithoutWhere";
import { updateWithoutWhereRule } from "./updateWithoutWhere";
import { insertWithoutColumnsRule } from "./insertWithoutColumns";
import { selectWithoutWhereRule } from "./selectWithoutWhere";

export const rules: SQLRule[] = [
    selectStarRule,
    joinWithoutOnRule,
    likeLeadingPercentRule,
    orderByWithoutLimitRule,
    deleteWithoutWhereRule,
    updateWithoutWhereRule,
    insertWithoutColumnsRule,
    selectWithoutWhereRule
];
