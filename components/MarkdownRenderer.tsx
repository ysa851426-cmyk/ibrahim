import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    // Helper function to render a single line, converting markdown to HTML
    const renderLine = (line: string) => {
        // Bold: **text** -> <strong>text</strong>
        let processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return { __html: processedLine };
    };

    return (
        <div className="space-y-1 text-gray-300">
            {content.split('\n').map((line, index) => {
                const trimmedLine = line.trim();

                // Handles "## Heading"
                if (trimmedLine.startsWith('## ')) {
                    return <h3 key={index} className="text-xl font-bold text-sky-400 mt-4 mb-1">{trimmedLine.substring(3)}</h3>;
                }

                // Handles "- List Item"
                if (trimmedLine.startsWith('- ')) {
                     return (
                        <div key={index} className="flex items-start">
                            <span className="mr-2 mt-1 text-sky-400">&bull;</span>
                            <p className="flex-1" dangerouslySetInnerHTML={renderLine(trimmedLine.substring(2))} />
                        </div>
                    );
                }

                // Handles paragraphs, which might contain bold text
                if (trimmedLine) {
                    return <p key={index} dangerouslySetInnerHTML={renderLine(trimmedLine)} />;
                }

                // Renders empty lines for spacing, if any
                return <div key={index} style={{ height: '0.5em' }} />;
            })}
        </div>
    );
};

export default MarkdownRenderer;