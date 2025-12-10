const { PrismaClient } = require("@prisma/client");
const CustomError = require("../../utils/CustomError");
const { includes, success } = require("zod/v4");
const prisma = new PrismaClient();

async function fetchAnswerFromThirdAPI(question, token, db_api) {
  // console.log("Payload:", JSON.stringify({ question, token, db_api }));
  const res = await fetch("https://ai.dcctz.com/aivabot/ask-demo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ANSWER_API_KEY ?? ""}`,
    },
    body: JSON.stringify({ question, token, db_api }),
  });
  // console.log("Third API response status: ???????????", res);
  if (!res.ok) {
    return false;
    // throw new CustomError(
    //   `Answer API failed (${res.status}): ${res.statusText}`,500
    // );
  }
  const data = await res.json();

  return data;
  //   if (!data?.answer || typeof data.answer !== "string")
  //     throw new Error("Answer API returned an invalid payload");
  //   return data.answer;
}
// Create a new chat
const askQuestion = async (data) => {
  try {
    const { userId, db_api, question, sql_code, categoryTag, token } = data;
    // const aiAnswer = { text: "This is a placeholder answer." };
    const aiAnswer = await fetchAnswerFromThirdAPI(question, token, db_api);
    // console.log("AI Answer:", aiAnswer);
    // if (!aiAnswer) {
    //   return {
    //     status: 502,
    //     message: "Error creating chat: Answer API failed",
    //     success: false,
    //   };
    // }
    let modifiedAnswer = !aiAnswer
      ? "I'm sorry, there is no relevant data available to answer your question."
      : aiAnswer?.data;
    const isEmpty = aiAnswer?.data?.trim() === "|  |\n|---|\n| None |";
    // ||
    // aiAnswer?.data?.trim().toLowerCase().includes("none");

    if (isEmpty) {
      modifiedAnswer =
        "I'm sorry, but there is no relevant data available to answer your question.";
    }

    const result = await prisma.$transaction(async (tx) => {
      let chatId = data?.chatId ?? null;

      if (chatId != null) {
        const chat = await tx.ChatHistory.findUnique({
          where: { id: chatId },
          select: { id: true, user_id: true },
        });
        if (!chat || chat.user_id !== userId)
          throw new Error("Chat not found or does not belong to this user");
      } else {
        const created = await tx.ChatHistory.create({
          data: {
            user_id: userId,
            startTime: new Date(),
            endTime: new Date(),
            totalMessages: 0,
            title: question.slice(0, 50),
            categoryTag: categoryTag ?? null,
          },
          select: { id: true },
        });
        chatId = created?.id;
      }

      const detail = await tx.chatDetails.create({
        data: {
          chatId: chatId,
          question,
          aiAnswer: modifiedAnswer ?? "No answer found",
          sql_code: sql_code ?? null,
          categoryTag: categoryTag ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await tx.ChatHistory.update({
        where: { id: chatId },
        data: {
          totalMessages: { increment: 1 },
          endTime: new Date(),
          ...(categoryTag ? { categoryTag } : {}),
        },
      });

      return { chatId, detailId: detail.id };
    });

    return {
      data: result,
      chatId: result.chatId,
      detailId: result.detailId,
      answer: aiAnswer,
    };
  } catch (err) {
    console.error(err);
    const message = err?.message ?? "Internal server error";
    const status = /not found|does not belong|invalid/i.test(message)
      ? 400
      : 500;
    res.status(status).json({ error: message });
    throw new CustomError(`Error creating chat: ${error.message}`, 500);
  }
};

// // Find a chat by ID
// const getChatDetail = async (id) => {
//   try {
//     const chat = await prisma.ChatHistory.findUnique({
//       where: { id: parseInt(id) },
//       include: {
//         ChatDetails: true, // load related details
//       },
//     });

//     return chat;
//   } catch (error) {
//     throw new CustomError(`Error finding chat by ID: ${error.message}`, 503);
//   }
// };
// Fetch chat messages with cursor-based pagination (WhatsApp-style scroll up to load older messages)
// const getChatDetail = async ({ chatId,  limit, beforeId }) => {
//   try {
//     const take = limit + 1; // fetch one extra to detect "hasMore"
//     const where = { chatId: parseInt(chatId) };

//     const findArgs = {
//       where,
//       orderBy: { createdAt: "desc" }, // newest first for efficient cursor paging
//       // take,
//     };

//     // if (cursor) {
//     //   // cursor should be the message id of the last item from previous page (the oldest currently loaded)
//     //   findArgs.cursor = { id: parseInt(cursor, 10) };
//     //   findArgs.skip = 1; // skip the cursor item itself
//     // }

//     const rows = await prisma.ChatDetails.findMany(findArgs);

//     const hasMore = rows.length === take;
//     const page = hasMore ? rows.slice(0, -1) : rows; // remove extra item if present

//     // rows were loaded newest-first; return them oldest-first so client can append at top naturally
//     const messages = page.reverse();

//     const nextCursor = messages.length ? messages[0].id : null;
//     // nextCursor represents the id of the oldest message in this returned page.
//     // When client loads more (older) messages, pass that id as cursor to fetch earlier items.

//     return { ChatDetails: messages, nextCursor, hasMore };
//   } catch (error) {
//     console.log("Error in getChatDetail:", error);
//     throw new CustomError(
//       `Error fetching paginated chat messages: ${error.message}`,
//       503
//     );
//   }
// };

const getChatDetail = async ({ chatId, limit = 20, beforeId = null }) => {
  try {
    // clamp limit 1..50
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
    // fetch one extra row to detect "hasMore"
    const take = safeLimit + 1;

    const numericChatId = Number(chatId);
    const numericBeforeId =
      beforeId !== null && beforeId !== undefined && beforeId !== ""
        ? Number(beforeId)
        : null;

    // Build where clause: older-than filter when beforeId is present
    const where = numericBeforeId
      ? { chatId: numericChatId, id: { lt: numericBeforeId } }
      : { chatId: numericChatId };

    // Query newest-first for index efficiency, then reverse in memory
    const rowsDesc = await prisma.ChatDetails.findMany({
      where,
      orderBy: { id: "desc" }, // use id for stable monotonic paging
      take, // <-- IMPORTANT: enforce limit (+1 sentinel)
      select: {
        id: true,
        chatId: true,
        question: true,
        aiAnswer: true, // rename to match your column if needed
        sql_code: true,
        categoryTag: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Trim the extra item (if present) and compute hasMore
    const hasMore = rowsDesc.length === take;
    const pageDesc = hasMore ? rowsDesc.slice(0, -1) : rowsDesc;

    // Return oldest→newest to the client
    const messages = pageDesc.slice().reverse();

    // Cursor for next OLDER page = oldest id of this page
    const nextCursor = messages.length ? messages[0].id : null;

    return { ChatDetails: messages, nextCursor, hasMore };
  } catch (error) {
    console.error("Error in getChatDetail:", error);
    throw new CustomError(
      `Error fetching chat messages: ${error.message}`,
      503
    );
  }
};
// Get all chats
const getChatHistory = async (
  userId,
  search,
  page,
  size,
  startDate,
  endDate,
  is_active
) => {
  try {
    const chats = await prisma.ChatHistory.findMany({
      where: { user_id: userId },
      orderBy: [{ startTime: "desc" }, { endTime: "desc" }],
      //   includes: {
      //     ChatDetails: true,
      //   },
    });
    return chats;
  } catch (error) {
    throw new CustomError("Error retrieving chat", 503);
  }
};
const deletChatHistory = async (id) => {
  try {
    const chats = await prisma.ChatHistory.delete({
      where: { id },
    });
    return chats;
  } catch (error) {
    throw new CustomError("Error retrieving chat", 503);
  }
};

module.exports = {
  askQuestion,
  getChatDetail,
  getChatHistory,
  deletChatHistory,
};
